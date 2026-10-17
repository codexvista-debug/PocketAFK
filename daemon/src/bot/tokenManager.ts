import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
const minecraftFolderPath = require('minecraft-folder-path');

/**
 * Calculates the exact 6-character SHA-1 cache key used by prismarine-auth / node-minecraft-protocol
 */
export function computeNameHash(name: string): string {
  return crypto.createHash('sha1').update(name ?? '', 'binary').digest('hex').substring(0, 6);
}

/**
 * Gets the primary persistent directory for Microsoft OAuth tokens.
 * Storing in $HOME/.pocketafk_tokens ensures tokens survive git pulls, app updates, and restarts.
 */
export function getPersistentTokenFolder(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  const persistentDir = home ? path.resolve(home, '.pocketafk_tokens') : path.resolve(process.cwd(), 'tokens');
  if (!fs.existsSync(persistentDir)) {
    try {
      fs.mkdirSync(persistentDir, { recursive: true });
    } catch (e) {}
  }
  return persistentDir;
}

/**
 * Returns the active working tokens folder and synchronizes with the permanent storage
 */
export function getAndSyncTokenFolder(): string {
  const localFolder = path.resolve(process.cwd(), 'tokens');
  const persistentFolder = getPersistentTokenFolder();

  if (!fs.existsSync(localFolder)) {
    try {
      fs.mkdirSync(localFolder, { recursive: true });
    } catch (e) {}
  }

  const possibleSources = [
    persistentFolder,
    path.resolve(process.cwd(), '..', 'tokens'),
    path.resolve(process.cwd(), 'profiles'),
    path.join(minecraftFolderPath, 'nmp-cache'),
    path.resolve(process.env.HOME || '', '.minecraft', 'nmp-cache'),
    path.resolve(process.env.HOME || '', 'tokens'),
    path.resolve(process.env.HOME || '', 'PocketAFK', 'tokens'),
    path.resolve(process.env.HOME || '', 'PocketAFK', 'daemon', 'tokens'),
    path.resolve(process.env.HOME || '', 'VistaAFK', 'tokens'),
    path.resolve(process.env.HOME || '', 'VistaAFK', 'daemon', 'tokens'),
  ];

  // 1. Ingest any existing tokens into localFolder
  for (const srcDir of possibleSources) {
    if (fs.existsSync(srcDir) && srcDir !== localFolder) {
      try {
        const files = fs.readdirSync(srcDir);
        for (const f of files) {
          if (!f.endsWith('.json')) continue;
          const srcFile = path.join(srcDir, f);
          const dstFile = path.join(localFolder, f);
          if (!fs.existsSync(dstFile) && fs.statSync(srcFile).isFile()) {
            fs.copyFileSync(srcFile, dstFile);
          }
        }
      } catch (e) {}
    }
  }

  // 2. Also back up localFolder to persistentFolder so it stays permanently safe
  if (localFolder !== persistentFolder && fs.existsSync(localFolder)) {
    try {
      const files = fs.readdirSync(localFolder);
      for (const f of files) {
        if (!f.endsWith('.json')) continue;
        const srcFile = path.join(localFolder, f);
        const dstFile = path.join(persistentFolder, f);
        if (!fs.existsSync(dstFile) && fs.statSync(srcFile).isFile()) {
          fs.copyFileSync(srcFile, dstFile);
        }
      }
    } catch (e) {}
  }

  return localFolder;
}

/**
 * Automatically pairs and aliases cached Microsoft OAuth sessions to the target Minecraft account.
 * This ensures that once an account is authorized, PrismarineAuth finds the 90-day rolling refresh token
 * regardless of username casing, email vs IGN, or target name variations.
 */
export function ensureTokenAliases(tokenFolder: string, targetUsername: string, realIgn?: string) {
  try {
    if (!fs.existsSync(tokenFolder) || !targetUsername) return;
    const files = fs.readdirSync(tokenFolder);

    const cleanName = targetUsername.replace(/^@/, '').trim();
    const candidateNames = new Set<string>();
    candidateNames.add(cleanName);
    candidateNames.add(cleanName.toLowerCase());
    candidateNames.add(cleanName.toUpperCase());
    if (cleanName.includes('@')) {
      candidateNames.add(cleanName.split('@')[0]);
    }
    if (realIgn) {
      candidateNames.add(realIgn);
      candidateNames.add(realIgn.toLowerCase());
    }

    const targetHashes = new Set<string>();
    for (const name of candidateNames) {
      targetHashes.add(computeNameHash(name));
    }

    // Check if target already has a live cache
    let hasTargetLiveCache = false;
    for (const h of targetHashes) {
      if (fs.existsSync(path.join(tokenFolder, `${h}_live-cache.json`))) {
        hasTargetLiveCache = true;
        break;
      }
    }

    if (hasTargetLiveCache) {
      // Re-mirror to any missing target hash variations for full robustness
      const existingHash = Array.from(targetHashes).find((h) => fs.existsSync(path.join(tokenFolder, `${h}_live-cache.json`)));
      if (existingHash) {
        mirrorTokenSession(tokenFolder, existingHash, targetHashes);
      }
      return;
    }

    // Scan all mca cache files in tokenFolder to find matching Minecraft player profile
    let matchedSourceHash: string | null = null;
    const allLiveHashes: string[] = [];

    for (const f of files) {
      if (f.endsWith('_live-cache.json')) {
        const hash = f.replace('_live-cache.json', '');
        allLiveHashes.push(hash);
      }
      if (f.endsWith('_mca-cache.json')) {
        const hash = f.replace('_mca-cache.json', '');
        try {
          const content = JSON.parse(fs.readFileSync(path.join(tokenFolder, f), 'utf8'));
          const ign = (content?.profile?.name || '').trim();
          if (ign) {
            for (const candidate of candidateNames) {
              if (ign.toLowerCase() === candidate.toLowerCase()) {
                matchedSourceHash = hash;
                break;
              }
            }
          }
        } catch (e) {}
      }
      if (matchedSourceHash) break;
    }

    // If no MCA name match was found, but there is only 1 live-cache in the folder,
    // this single session is the user's primary Minecraft account on this device!
    if (!matchedSourceHash && allLiveHashes.length === 1) {
      matchedSourceHash = allLiveHashes[0];
      console.log(`[PocketAFK Auth] Automatically pairing primary Microsoft session (${matchedSourceHash}) with account @${targetUsername}`);
    }

    // Mirror the discovered token session to all target hashes
    if (matchedSourceHash) {
      mirrorTokenSession(tokenFolder, matchedSourceHash, targetHashes);
    }
  } catch (err: any) {
    console.warn('[PocketAFK Auth] Token aliasing warning:', err.message);
  }
}

/**
 * Copies all session files (_live, _mca, _xbl, _sisu) from a source hash to target hashes
 */
function mirrorTokenSession(tokenFolder: string, sourceHash: string, targetHashes: Set<string>) {
  try {
    const files = fs.readdirSync(tokenFolder);
    for (const targetHash of targetHashes) {
      if (targetHash === sourceHash) continue;
      for (const f of files) {
        if (f.startsWith(`${sourceHash}_`)) {
          const suffix = f.substring(sourceHash.length);
          const src = path.join(tokenFolder, f);
          const dst = path.join(tokenFolder, `${targetHash}${suffix}`);
          if (!fs.existsSync(dst)) {
            fs.copyFileSync(src, dst);
          }
        }
      }
    }

    // Also sync mirrored files to persistent storage
    const persistentFolder = getPersistentTokenFolder();
    if (persistentFolder !== tokenFolder) {
      const updatedFiles = fs.readdirSync(tokenFolder);
      for (const f of updatedFiles) {
        if (!f.endsWith('.json')) continue;
        const src = path.join(tokenFolder, f);
        const dst = path.join(persistentFolder, f);
        if (!fs.existsSync(dst)) {
          try { fs.copyFileSync(src, dst); } catch (e) {}
        }
      }
    }
  } catch (e) {}
}

/**
 * Backs up all cached token files to permanent Android storage
 */
export function backupTokens(tokenFolder: string) {
  try {
    const persistentFolder = getPersistentTokenFolder();
    if (persistentFolder === tokenFolder || !fs.existsSync(tokenFolder)) return;
    const files = fs.readdirSync(tokenFolder);
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      const src = path.join(tokenFolder, f);
      const dst = path.join(persistentFolder, f);
      fs.copyFileSync(src, dst);
    }
  } catch (e) {}
}
