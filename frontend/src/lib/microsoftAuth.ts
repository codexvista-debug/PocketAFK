/**
 * Builds the Microsoft "remote connect" URL that pre-fills the device-code (otc)
 * and lands the user directly on the Microsoft sign-in form. Unlike
 * microsoft.com/link, this endpoint keeps the code through the redirect, so the
 * user never has to type or paste it.
 */
export const MICROSOFT_LOGOUT_URL = 'https://login.live.com/logout.srf';

export function buildMicrosoftSignInUrl(userCode?: string | null, fallbackUrl?: string | null, loginHint?: string | null): string {
  const code = (userCode || '').trim();
  if (!code) return fallbackUrl || 'https://www.microsoft.com/link';
  let url = `https://login.live.com/oauth20_remoteconnect.srf?otc=${encodeURIComponent(code)}`;
  if (loginHint && loginHint.trim() && loginHint.includes('@')) {
    url += `&login_hint=${encodeURIComponent(loginHint.trim())}`;
  }
  return `${url}&prompt=login`;
}
