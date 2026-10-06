import { emit } from "@/server/bus";
import { finishOpenRouterAuth } from "@/server/agent/openrouter";
import { models, resetModels } from "@/server/agent/client";
import { computerInfo } from "@/server/snapshot";

// OpenRouter redirects back here after the user authorizes in the browser.
// This route completes the OAuth PKCE exchange, securely stores the key,
// and notifies the app through the event stream.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  let error = url.searchParams.get("error_description") ?? url.searchParams.get("error");

  if (code && !error) {
    try {
      await finishOpenRouterAuth(code);
      resetModels();
      emit({ type: "computer", data: computerInfo() });
      void models().then(() => emit({ type: "computer", data: computerInfo() })).catch(() => {});
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }

  return new Response(renderPage(error), {
    status: error ? 400 : 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function renderPage(error: string | null): string {
  const title = error ? "Couldn't connect to OpenRouter" : "Connected to OpenRouter";
  const body = error
    ? escapeHtml(error)
    : "Your dots can use OpenRouter models now. You can close this tab and go back to Maxdots.";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title} · Maxdots</title>
  <style>
    :root { color-scheme: light dark; --bg: #f6f6f6; --card: #ffffff; --fg: #0a0a0a; --muted: #0a0a0a99; --line: #0a0a0a14; --brand: #6366f1; }
    @media (prefers-color-scheme: dark) { :root { --bg: #0e0e0e; --card: #171717; --fg: #f4f4f4; --muted: #f4f4f499; --line: #ffffff14; --brand: #818cf8; } }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg); font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 16px; box-sizing: border-box; }
    .card { max-width: 440px; width: 100%; background: var(--card); border: 1px solid var(--line); border-radius: 16px; padding: 32px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-align: center; }
    .icon { width: 48px; height: 48px; margin: 0 auto 16px; border-radius: 12px; background: rgba(99, 102, 241, 0.12); display: flex; align-items: center; justify-content: center; font-size: 24px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 10px; }
    p { margin: 0 0 20px; color: var(--muted); font-size: 14px; }
    .btn { display: inline-block; background: var(--brand); color: #fff; text-decoration: none; font-weight: 500; font-size: 13px; padding: 9px 18px; border-radius: 8px; transition: opacity 0.15s; }
    .btn:hover { opacity: 0.9; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${error ? "⚠️" : "⚡"}</div>
    <h1>${title}</h1>
    <p>${body}</p>
    <a href="/settings#computers" class="btn">Return to Maxdots</a>
  </div>
  <script>
    // Automatically close tab or refocus parent if opened as a popup
    if (window.opener && !${JSON.stringify(Boolean(error))}) {
      try { window.opener.focus(); } catch (e) {}
      setTimeout(() => { window.close(); }, 1200);
    }
  </script>
</body>
</html>`;
}
