import React from "react";
import { renderToString } from "react-dom/server";
import { StaticRouter } from "react-router-dom/server";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { getPostBySlug, type Post } from "./lib/markdown";

type WorkerEnv = { ASSETS: { fetch: (request: Request) => Promise<Response> } };
declare global { var __INITIAL_DATA__: { post?: Post } | undefined; }

export async function render(url: string, env: WorkerEnv) {
  const parsed = new URL(url, "https://zandani.co.ke");
  const match = parsed.pathname.match(/^\/article\/([^/]+)\/?$/);
  if (!match) return null;
  let slug = "";
  try { slug = decodeURIComponent(match[1]); } catch { return null; }
  const post = await getPostBySlug(slug, (input) => env.ASSETS.fetch(new Request(new URL(input, parsed.origin))));
  if (!post) return null;
  const context: { helmet?: any } = {};
  globalThis.__INITIAL_DATA__ = { post };
  let appHtml = "";
  try {
    appHtml = renderToString(
      <React.StrictMode>
        <HelmetProvider context={context}>
          <StaticRouter location={parsed.pathname + parsed.search}>
            <App />
          </StaticRouter>
        </HelmetProvider>
      </React.StrictMode>
    );
  } finally {
    globalThis.__INITIAL_DATA__ = undefined;
  }
  return { appHtml, helmet: context.helmet, post };
}
