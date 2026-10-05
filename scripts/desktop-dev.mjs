import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const root = path.resolve(import.meta.dirname, "..");
const child = spawn(
  process.execPath,
  [require.resolve("electron/cli.js"), "electron"],
  {
    cwd: root,
    env: { ...process.env, MAXDOTS_DEV_URL: process.env.MAXDOTS_DEV_URL || process.env.OPEN_DOT_DEV_URL || "http://localhost:3100" },
    stdio: "inherit",
  },
);

child.on("error", (error) => {
  console.error("Couldn't start the Maxdots desktop window:", error);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  if (signal) {
    console.error(`Maxdots desktop exited after ${signal}.`);
    process.exitCode = 1;
  } else {
    process.exitCode = code ?? 1;
  }
});
