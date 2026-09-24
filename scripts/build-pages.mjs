import { cpSync, existsSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";

function finalizePagesArtifact() {
  const nestedAssets = "dist/client/worlds-of-spice/_next";
  const publicAssets = "dist/client/_next";

  // vinext applies assetPrefix both to the emitted URL and its output folder.
  // GitHub Pages already mounts dist/client at /worlds-of-spice, so lift the
  // generated _next directory to the artifact root to avoid a doubled path.
  if (existsSync(nestedAssets)) {
    rmSync(publicAssets, { force: true, recursive: true });
    cpSync(nestedAssets, publicAssets, { recursive: true });
    rmSync("dist/client/worlds-of-spice", { force: true, recursive: true });
  }
}

const command = process.platform === "win32" ? "vinext.cmd" : "vinext";
const result = spawnSync(command, ["build"], {
  env: { ...process.env, GITHUB_PAGES: "true" },
  shell: true,
  stdio: "inherit",
});

if (result.status === 0) {
  finalizePagesArtifact();
  process.exit(0);
}

// vinext beta can hit a libuv shutdown assertion on Windows after a fully
// successful static export. Never mask a failed or incomplete build.
if (process.platform === "win32" && existsSync("dist/client/index.html")) {
  finalizePagesArtifact();
  console.warn("Static export completed; ignoring the known Windows-only vinext shutdown assertion.");
  process.exit(0);
}

process.exit(result.status ?? 1);
