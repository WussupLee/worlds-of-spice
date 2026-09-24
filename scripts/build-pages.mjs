import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";

const command = process.platform === "win32" ? "vinext.cmd" : "vinext";
const result = spawnSync(command, ["build"], {
  env: { ...process.env, GITHUB_PAGES: "true" },
  shell: true,
  stdio: "inherit",
});

if (result.status === 0) process.exit(0);

// vinext beta can hit a libuv shutdown assertion on Windows after a fully
// successful static export. Never mask a failed or incomplete build.
if (process.platform === "win32" && existsSync("dist/client/index.html")) {
  console.warn("Static export completed; ignoring the known Windows-only vinext shutdown assertion.");
  process.exit(0);
}

process.exit(result.status ?? 1);
