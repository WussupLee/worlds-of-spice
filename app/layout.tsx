import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wussuplee.github.io/worlds-of-spice/"),
  title: "Worlds of Spice — Desert Pinball Odyssey",
  description: "A cinematic, mobile-first desert science-fiction pinball experience. Claim territories, awaken the Great Wyrm, and ascend.",
  icons: {
    icon: "./assets/playfield.png",
    shortcut: "./assets/playfield.png",
  },
  manifest: "./manifest.webmanifest",
  openGraph: {
    title: "Worlds of Spice",
    description: "Claim the territories. Read the sands. Awaken what sleeps below.",
    type: "website",
    images: [{ url: "./og.png", width: 1200, height: 630, alt: "Worlds of Spice desert pinball table" }],
  },
  twitter: { card: "summary_large_image", title: "Worlds of Spice", description: "A desert pinball odyssey.", images: ["./og.png"] },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
