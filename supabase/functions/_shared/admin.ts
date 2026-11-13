export async function verifyAdminSessionToken(token: string, secret: string): Promise<boolean> {
  if (!secret || secret.trim().length < 32) return false;
  const parts = String(token || "").split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return false;

  const decode = (value: string) => {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const binary = atob(padded);
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  };

  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret.trim()),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    const valid = await crypto.subtle.verify(
      "HMAC",
      key,
      decode(parts[1]),
      new TextEncoder().encode(parts[0]),
    );
    if (!valid) return false;

    const claims = JSON.parse(new TextDecoder().decode(decode(parts[0])));
    const now = Math.floor(Date.now() / 1000);
    return claims.sub === "zandani-admin"
      && Number(claims.exp) > now
      && Number(claims.iat) <= now + 60;
  } catch {
    return false;
  }
}
