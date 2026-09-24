import { chromium } from "@playwright/test";
import { writeFileSync } from "node:fs";
const browser = await chromium.launch();
const page = await browser.newPage();
for (const size of [192, 512]) {
  const png = await page.evaluate((size) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const c = canvas.getContext("2d");
    c.scale(size / 512, size / 512);
    c.fillStyle = "#102c3a";
    c.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 5; i++) {
      c.strokeStyle = i % 2 ? "#ef763f" : "#efc58d";
      c.lineWidth = i === 0 ? 5 : 2;
      c.beginPath();
      c.ellipse(256, 256, 159 - i * 9, 159 - i * 9, 0, 0, Math.PI * 2);
      c.stroke();
    }
    c.strokeStyle = "#efc58d";
    c.lineWidth = 2;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      c.beginPath();
      c.moveTo(256 + Math.cos(a) * 124, 256 + Math.sin(a) * 124);
      c.lineTo(256 + Math.cos(a) * 160, 256 + Math.sin(a) * 160);
      c.stroke();
    }
    const ball = c.createRadialGradient(244, 230, 1, 256, 245, 47);
    ball.addColorStop(0, "#ffffff");
    ball.addColorStop(0.24, "#dce4dc");
    ball.addColorStop(0.46, "#7aabba");
    ball.addColorStop(0.6, "#193847");
    ball.addColorStop(0.9, "#a6d1cf");
    ball.addColorStop(1, "#0b1c2b");
    c.fillStyle = ball;
    c.beginPath();
    c.arc(256, 244, 45, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 16;
    c.lineCap = "round";
    c.strokeStyle = "#ef763f";
    for (const [a, b] of [
      [177, 239],
      [335, 273],
    ]) {
      c.beginPath();
      c.moveTo(a, 313);
      c.lineTo(b, 340);
      c.stroke();
    }
    c.fillStyle = "#f4deb0";
    c.font = "12px Arial";
    c.textAlign = "center";
    c.letterSpacing = "4px";
    c.fillText("WORLDS OF SPICE", 256, 453);
    return canvas.toDataURL("image/png").split(",")[1];
  }, size);
  writeFileSync(`public/icon-${size}.png`, Buffer.from(png, "base64"));
}
await browser.close();
