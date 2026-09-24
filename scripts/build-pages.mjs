import {
  cpSync,
  existsSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import path from "node:path";

const started = Date.now();
const command = process.platform === "win32" ? "vinext.cmd" : "vinext";
const result = spawnSync(command, ["build"], {
  env: { ...process.env, GITHUB_PAGES: "true" },
  shell: true,
  encoding: "utf8",
  maxBuffer: 20 * 1024 * 1024,
});
process.stdout.write(result.stdout || "");
process.stderr.write(result.stderr || "");
const root = path.resolve("dist/client");
const index = path.join(root, "index.html");
// Only tolerate the known Windows shutdown assertion after a freshly emitted export.
// A stale index.html must never turn a failed build into a successful deployment.
const shutdownOnly =
  process.platform === "win32" &&
  /Assertion failed:.*UV_HANDLE_CLOSING/s.test(result.stderr || "") &&
  /Prerendered [1-9]\d* routes/.test(result.stdout || "") &&
  /Build complete\./.test(result.stdout || "") &&
  !/(?:error during build|failed to build|TypeError|SyntaxError)/i.test(
    result.stdout + result.stderr,
  ) &&
  existsSync(index) &&
  statSync(index).mtimeMs >= started;
if (result.error || (result.status !== 0 && !shutdownOnly))
  process.exit(result.status || 1);
if (!existsSync(index) || statSync(index).mtimeMs < started)
  throw new Error("No fresh static export was produced.");

function removeGenerated(relative) {
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep) || target === root)
    throw new Error("Unsafe artifact path");
  rmSync(target, { force: true, recursive: true });
}
// Pages mounts the artifact at /worlds-of-spice; vinext also nests assetPrefix on disk.
const nested = path.join(root, "worlds-of-spice/_next");
if (existsSync(nested)) {
  removeGenerated("_next");
  cpSync(nested, path.join(root, "_next"), { recursive: true });
  removeGenerated("worlds-of-spice");
}
const html = readFileSync(index, "utf8");
for (const [, url] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
  if (!url.startsWith("/worlds-of-spice/_next/")) continue;
  if (!existsSync(path.join(root, url.replace("/worlds-of-spice/", "")))) {
    throw new Error(`Export references a missing asset: ${url}`);
  }
}
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory()
      ? walk(path.join(dir, entry.name))
      : [path.join(dir, entry.name)],
  );
}
const files = walk(root).filter(
  (f) =>
    !f.endsWith("sw.js") && !f.endsWith(".map") && !f.endsWith(".DS_Store"),
);
const hash = createHash("sha256");
files.sort().forEach((file) => hash.update(readFileSync(file)));
const template = readFileSync("public/sw.js", "utf8");
hash.update(template);
const version = hash.digest("hex").slice(0, 16);
const urls = [
  "./",
  ...files.map(
    (file) => "./" + path.relative(root, file).split(path.sep).join("/"),
  ),
];
writeFileSync(
  path.join(root, "sw.js"),
  template
    .replace('"__BUILD_VERSION__"', JSON.stringify(version))
    .replace('["__PRECACHE__"]', JSON.stringify(urls)),
);
writeFileSync(path.join(root, ".nojekyll"), "");
console.log(
  `Pages artifact verified: ${files.length} files, offline version ${version}.`,
);
if (shutdownOnly)
  console.warn(
    "Verified a fresh export; tolerated the Windows-only libuv shutdown assertion.",
  );
