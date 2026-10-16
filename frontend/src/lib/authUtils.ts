import crypto from 'crypto';

export const USERNAME_REGEX = /^[a-zA-Z0-9]{1,6}$/;
export const SALT = '_pocketafk_salt_secure_2026_x89';
export const SECRET_EXTRA_SALT = '_x7k9_extra_sec';

export function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password + SALT).digest('hex');
}

export function generateSecretCode(passwordHash: string): string {
  // A hash of password hash + random-style 4 salt letters 'x7k9'
  const hash = crypto.createHash('sha256').update(passwordHash + SECRET_EXTRA_SALT).digest('hex');
  return `pk_${hash.substring(0, 10)}`;
}
