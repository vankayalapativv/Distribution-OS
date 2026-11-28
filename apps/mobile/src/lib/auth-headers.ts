/** Bearer auth headers for an authed request (e.g. fetching an authed image via
 *  `expo-image`), or undefined when there's no token. One place to evolve the
 *  header shape, shared by the claim form and the customer photo views. */
export function authHeaders(token: string | null): Record<string, string> | undefined {
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}
