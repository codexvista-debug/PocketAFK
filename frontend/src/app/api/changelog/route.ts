import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 60; // Cache for 60 seconds

interface GitHubCommitItem {
  sha: string;
  commit: {
    message: string;
    author: {
      name: string;
      date: string;
    };
  };
  author?: {
    login: string;
    avatar_url: string;
    html_url: string;
  } | null;
  html_url: string;
}

export interface DeploymentItem {
  id: string;
  sha: string;
  shortSha: string;
  message: string;
  fullMessage: string;
  branch: 'main' | 'dev';
  environment: 'Production' | 'Preview';
  status: 'Ready';
  buildDuration: string;
  date: string;
  timestamp: number;
  author: {
    name: string;
    login: string;
    avatarUrl: string;
    profileUrl: string;
  };
  commitUrl: string;
}

export async function GET() {
  try {
    const headers = {
      'User-Agent': 'PocketAFK-Changelog-Engine',
      Accept: 'application/vnd.github.v3+json',
    };

    // Fetch up to 25 latest commits from main and dev
    const [mainRes, devRes] = await Promise.all([
      fetch('https://api.github.com/repos/codexvista-debug/PocketAFK/commits?sha=main&per_page=25', {
        headers,
        next: { revalidate: 60 },
      }),
      fetch('https://api.github.com/repos/codexvista-debug/PocketAFK/commits?sha=dev&per_page=25', {
        headers,
        next: { revalidate: 60 },
      }),
    ]);

    const deployments: DeploymentItem[] = [];

    if (mainRes.ok) {
      const mainCommits: GitHubCommitItem[] = await mainRes.json();
      for (const c of mainCommits) {
        deployments.push(mapToDeployment(c, 'main'));
      }
    }

    if (devRes.ok) {
      const devCommits: GitHubCommitItem[] = await devRes.json();
      for (const c of devCommits) {
        deployments.push(mapToDeployment(c, 'dev'));
      }
    }

    // Sort by timestamp descending
    deployments.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({
      success: true,
      updatedAt: new Date().toISOString(),
      deployments,
    });
  } catch (error: any) {
    console.error('[Changelog API Error]', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to fetch live deployments',
        deployments: [],
      },
      { status: 500 }
    );
  }
}

function mapToDeployment(c: GitHubCommitItem, branch: 'main' | 'dev'): DeploymentItem {
  const shortSha = c.sha.substring(0, 7);
  const firstLine = (c.commit.message || '').split('\n')[0].trim();
  const dateStr = c.commit.author?.date || new Date().toISOString();
  const timestamp = new Date(dateStr).getTime();

  // Pseudo-random deterministic build duration (28s - 45s) for realistic Vercel feel
  const hashSum = shortSha.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  const buildSec = 28 + (hashSum % 18);

  return {
    id: `${branch}-${c.sha}`,
    sha: c.sha,
    shortSha,
    message: firstLine || `Commit ${shortSha}`,
    fullMessage: c.commit.message,
    branch,
    environment: branch === 'main' ? 'Production' : 'Preview',
    status: 'Ready',
    buildDuration: `${buildSec}s`,
    date: dateStr,
    timestamp,
    author: {
      name: c.commit.author?.name || 'codexvista',
      login: c.author?.login || 'codexvista',
      avatarUrl: c.author?.avatar_url || 'https://github.com/codexvista-debug.png',
      profileUrl: c.author?.html_url || 'https://github.com/codexvista-debug',
    },
    commitUrl: c.html_url || `https://github.com/codexvista-debug/PocketAFK/commit/${c.sha}`,
  };
}
