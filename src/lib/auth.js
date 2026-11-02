export const USERNAME_DOMAIN = 'usuarios.mensajeros911.local';

export function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
}

export function usernameToAuthEmail(value) {
  const username = normalizeUsername(value);
  return username ? `${username}@${USERNAME_DOMAIN}` : '';
}
