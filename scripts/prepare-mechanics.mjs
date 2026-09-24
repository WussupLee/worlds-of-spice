// Reproducible edits of CC0 recordings. See public/audio/mechanics/LICENSE.txt.
// Original publicly streamed HQ files go in work/pinball-recordings/{id}.mp3.
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
const ffmpeg = process.env.FFMPEG_PATH || "ffmpeg";
const clips = [
  ["flipper-a", 450270, 0.16, 0.22],
  ["flipper-b", 450270, 2.5, 0.22],
  ["release", 450270, 0.4, 0.11],
  ["bumper-a", 450265, 1.145, 0.24],
  ["bumper-b", 450265, 1.965, 0.25],
  ["plunger", 450267, 1.43, 0.95],
  ["drain", 450266, 0.75, 0.48],
  ["relay", 450268, 0.23, 0.18],
  ["rolling", 450267, 1.73, 0.9],
];
mkdirSync("public/audio/mechanics", { recursive: true });
for (const [name, id, start, duration] of clips) {
  const result = spawnSync(
    ffmpeg,
    [
      "-v",
      "error",
      "-i",
      `work/pinball-recordings/${id}.mp3`,
      "-ss",
      String(start),
      "-t",
      String(duration),
      "-ac",
      "1",
      "-ar",
      "44100",
      "-af",
      `highpass=f=90,lowpass=f=6500,afade=t=in:d=0.003,afade=t=out:st=${duration - 0.035}:d=0.035`,
      "-f",
      "f32le",
      "pipe:1",
    ],
    { maxBuffer: 10e6 },
  );
  if (result.status !== 0)
    throw new Error(result.stderr?.toString() || "ffmpeg failed");
  const raw = result.stdout;
  let peak = 0;
  for (let i = 0; i < raw.length; i += 4)
    peak = Math.max(peak, Math.abs(raw.readFloatLE(i)));
  const count = raw.length / 4,
    wav = Buffer.alloc(44 + count * 2);
  wav.write("RIFF");
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(44100, 24);
  wav.writeUInt32LE(88200, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(count * 2, 40);
  for (let i = 0; i < count; i++)
    wav.writeInt16LE(
      Math.round(raw.readFloatLE(i * 4) * (0.72 / peak) * 32767),
      44 + i * 2,
    );
  writeFileSync(`public/audio/mechanics/${name}.wav`, wav);
  console.log(
    `${name}: ${count / 44100}s, ${wav.length} bytes, peak normalized to -2.85 dBFS`,
  );
}
