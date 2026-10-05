// Maxdots desktop shell. Runs the Next.js standalone server as a background process (Electron's own Node,
// so nothing else needs installing) and shows it in a window. Closing the window keeps the server running,
// so dots keep working and routines keep firing; quit from the menu or with ⌘Q.

import { app, BrowserWindow, shell, session, dialog } from "electron";
import path from "node:path";
import fs from "node:fs";
import http from "node:http";
import { spawn, execFileSync } from "node:child_process";

// Fixed, because Composio's sign-in redirects back to this address.
const PORT = Number(process.env.MAXDOTS_PORT || process.env.OPEN_DOT_PORT || 3100);
// Development: point the window at `pnpm dev` instead of starting the bundled server.
const DEV_URL = process.env.MAXDOTS_DEV_URL || process.env.OPEN_DOT_DEV_URL;
const APP_URL = DEV_URL || `http://localhost:${PORT}`;

// Keep using the existing Open Dot data directory after the product rename.
app.setPath("userData", path.join(app.getPath("appData"), "Open Dot"));
const isOurs = (url) => {
  try {
    const u = new URL(url);
    return (u.hostname === "localhost" || u.hostname === "127.0.0.1") && Number(u.port) === Number(new URL(APP_URL).port);
  } catch {
    return false;
  }
};

let server = null;
let win = null;
let quitting = false;

// Apps opened from Finder get a bare PATH; dots need the user's tools (git, docker, python, brew…).
function loginPath() {
  if (process.platform === "win32") return process.env.PATH || "";
  try {
    const shellPath = process.env.SHELL || "/bin/zsh";
    return execFileSync(shellPath, ["-ilc", "printf %s \"$PATH\""], { timeout: 5000, encoding: "utf8" }).trim();
  } catch {
    return ["/opt/homebrew/bin", "/usr/local/bin", process.env.PATH].filter(Boolean).join(path.delimiter);
  }
}

function startServer() {
  const dir = app.isPackaged ? path.join(process.resourcesPath, "server") : path.join(import.meta.dirname, "..", ".next", "standalone");
  if (!fs.existsSync(path.join(dir, "server.js"))) {
    dialog.showErrorBox("Maxdots", `The app server is missing (${dir}). Run \`pnpm desktop:prepare\` first.`);
    app.exit(1);
    return;
  }
  const dataDir = path.join(app.getPath("userData"), "data");
  const log = fs.createWriteStream(path.join(app.getPath("userData"), "server.log"), { flags: "a" });
  server = spawn(process.execPath, [path.join(dir, "server.js")], {
    cwd: dir,
    env: {
      ...process.env,
      PATH: loginPath(),
      ELECTRON_RUN_AS_NODE: "1",
      NODE_ENV: "production",
      PORT: String(PORT),
      HOSTNAME: "127.0.0.1",
      DOTS_DATA_DIR: dataDir,
      DOTS_PUBLIC_URL: `http://localhost:${PORT}`,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout.pipe(log);
  server.stderr.pipe(log);
  server.on("exit", (code) => {
    server = null;
    if (quitting) return;
    dialog.showErrorBox("Maxdots", `The app server stopped (code ${code}). Details are in ${path.join(app.getPath("userData"), "server.log")}.`);
    app.quit();
  });
}

function waitForServer(timeoutMs = 60_000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(`${APP_URL}/globe.svg`, (res) => (res.resume(), resolve()));
      req.on("error", () => (Date.now() - started > timeoutMs ? reject(new Error("The app server didn't start.")) : setTimeout(tick, 250)));
      req.setTimeout(2000, () => req.destroy());
    };
    tick();
  });
}

const splashLogoPath = app.isPackaged
  ? path.join(process.resourcesPath, "server", "public", "logo_head_transparent.png")
  : path.join(import.meta.dirname, "..", "public", "logo_head_transparent.png");
const splashLogo = fs.readFileSync(splashLogoPath).toString("base64");
const LOADING = `data:text/html;charset=utf-8,${encodeURIComponent(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
  *{box-sizing:border-box}html,body{height:100%;margin:0;background:#1c1c1c;color:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
  body{display:flex;align-items:center;justify-content:center;flex-direction:column;gap:20px;background:radial-gradient(ellipse at 50% 44%,rgba(98,100,167,.17),transparent 40%),#1c1c1c}
  img{width:144px;height:144px;object-fit:contain;filter:drop-shadow(0 12px 30px rgba(255,130,45,.16));animation:float 2.2s ease-in-out infinite}
  .name{font-size:18px;font-weight:500;letter-spacing:-.02em}.track{width:96px;height:4px;overflow:hidden;border-radius:99px;background:#ffffff1a}.track i{display:block;width:50%;height:100%;border-radius:99px;background:#8585f5;animation:load 1.2s ease-in-out infinite}
  @keyframes float{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-5px) scale(1.025)}}@keyframes load{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
  @media(prefers-reduced-motion:reduce){img,.track i{animation:none}}
</style></head><body><img src="data:image/png;base64,${splashLogo}" alt=""><div class="name">M-dots</div><div class="track"><i></i></div></body></html>`)}`;

function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 380,
    minHeight: 560,
    title: "Maxdots",
    backgroundColor: "#1c1c1c",
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.once("ready-to-show", () => win.show());

  // Links and sign-ins open in the default browser, never in an Electron window. The app opens Composio sign-in
  // as a blank popup and points it at the real URL a moment later, so that popup is kept hidden and its first
  // real address is handed to the browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url === "about:blank") return { action: "allow", overrideBrowserWindowOptions: { show: false } };
    if (/^https?:|^mailto:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("did-create-window", (child) => {
    const forward = (e, maybeUrl) => {
      const url = typeof maybeUrl === "string" ? maybeUrl : e?.url;
      if (!url || !/^https?:/.test(url)) return;
      void shell.openExternal(url);
      if (!child.isDestroyed()) child.destroy();
    };
    child.webContents.on("will-navigate", forward);
    child.webContents.on("did-start-navigation", forward);
    // Nothing to hand off (the app closed the popup, or it never got a URL): don't leave a hidden window behind.
    setTimeout(() => !child.isDestroyed() && child.destroy(), 30_000);
  });
  win.webContents.on("will-navigate", (e, url) => {
    if (isOurs(url) || url.startsWith("data:")) return;
    e.preventDefault();
    if (/^https?:|^mailto:/.test(url)) void shell.openExternal(url);
  });

  // Keep the server (and the dots) running when the window closes; ⌘Q quits for real.
  win.on("close", (e) => {
    if (process.platform === "darwin" && !quitting) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on("closed", () => (win = null));
  return win;
}

// Microphone (voice mode), notifications and clipboard, for our own pages only.
const ALLOWED = new Set(["media", "notifications", "clipboard-read", "clipboard-sanitized-write", "fullscreen"]);
function setPermissions() {
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback, details) =>
    callback(ALLOWED.has(permission) && isOurs(details.requestingUrl || "")),
  );
  session.defaultSession.setPermissionCheckHandler((_wc, permission, origin) => ALLOWED.has(permission) && isOurs(origin || ""));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!win) createWindow().loadURL(APP_URL);
    win.show();
    win.focus();
  });

  app.whenReady().then(async () => {
    setPermissions();
    createWindow();
    await win.loadURL(LOADING);
    if (!DEV_URL) startServer();
    try {
      await waitForServer();
      await win.loadURL(APP_URL);
    } catch (err) {
      dialog.showErrorBox("Maxdots", `${err.message}\n\nDetails are in ${path.join(app.getPath("userData"), "server.log")}.`);
      app.quit();
    }
  });

  app.on("activate", () => {
    if (win) win.show();
    else createWindow().loadURL(APP_URL);
  });

  app.on("before-quit", () => {
    quitting = true;
    server?.kill("SIGTERM");
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });
}
