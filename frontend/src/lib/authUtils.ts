import crypto from 'crypto';

export const USERNAME_REGEX = /^[a-zA-Z0-9]{1,6}$/;
export const SALT = '_pocketafk_salt_secure_2026_x89';
export const SECRET_EXTRA_SALT = '_x7k9_extra_sec';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

export function generateSecretCode(username: string, passwordHash: string): string {
  // Hash username + password hash + salt to ensure every user has a globally unique secret code
  const cleanUser = (username || '').trim().toLowerCase();
  const hash = crypto.createHash('sha256').update(`${cleanUser}:${passwordHash}:${SECRET_EXTRA_SALT}`).digest('hex');
  return `pk_${hash.substring(0, 10)}`;
}
