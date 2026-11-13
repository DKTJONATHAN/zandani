import { getAdminSessionToken } from "@/admin/utils/auth";

const utf8ToBase64 = (str: string) => {
  return window.btoa(unescape(encodeURIComponent(str)));
};

const base64ToUtf8 = (base64: string): string => {
  return decodeURIComponent(escape(window.atob(base64)));
};

export async function callGithubApi(payload: Record<string, unknown>) {
  const token = getAdminSessionToken();
  const res = await fetch('/api/github', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'GitHub Error');
  return data;
}

export async function getGithubFileSha(path: string): Promise<string | null> {
  try {
    const data = await callGithubApi({ action: 'GET_SHA', path });
    return data.sha;
  } catch {
    return null;
  }
}

export async function getGithubFileContent(path: string): Promise<string | null> {
  try {
    const data = await callGithubApi({ action: 'GET_CONTENT', path });
    return base64ToUtf8(data.content);
  } catch {
    return null;
  }
}

export async function pushToGithub(
  path: string,
  content: string,
  message: string,
  sha?: string
) {
  return await callGithubApi({
    action: 'PUSH',
    path,
    content: utf8ToBase64(content),
    message,
    sha,
  });
}

export async function deleteFromGithub(
  path: string,
  message: string,
  sha: string
) {
  return await callGithubApi({ action: 'DELETE', path, message, sha });
}
