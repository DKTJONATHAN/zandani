const SESSION_KEY = "admin_session";

export function getAdminSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(SESSION_KEY);
  if (!token) return null;

  try {
    const encodedPayload = token.split(".")[0];
    const base64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    const claims = JSON.parse(new TextDecoder().decode(bytes)) as { exp?: number; sub?: string };
    if (claims.sub !== "zandani-admin" || !claims.exp || claims.exp <= Math.floor(Date.now() / 1000)) {
      sessionStorage.removeItem(SESSION_KEY);
      return null;
    }
    return token;
  } catch {
    sessionStorage.removeItem(SESSION_KEY);
    return null;
  }
}

export function isAdminAuthenticated(): boolean {
  return Boolean(getAdminSessionToken());
}

export function setAdminAuthenticated(token: string | false) {
  if (typeof token === "string" && token) {
    sessionStorage.setItem(SESSION_KEY, token);
  } else {
    sessionStorage.removeItem(SESSION_KEY);
  }
}
