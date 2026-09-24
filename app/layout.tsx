import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://wussuplee.github.io/worlds-of-spice/"),
  title: "Worlds of Spice — Desert Pinball Odyssey",
  description:
    "A cinematic, mobile-first desert science-fiction pinball experience. Claim territories, awaken the Great Wyrm, and ascend.",
  icons: {
    icon: "./icon-192.png",
    apple: "./icon-192.png",
  },
  manifest: "./manifest.webmanifest",
  openGraph: {
    title: "Worlds of Spice",
    description:
      "Claim the territories. Read the sands. Awaken what sleeps below.",
    type: "website",
    images: [
      {
        url: "./og-v3.png",
        width: 1728,
        height: 910,
        alt: "Illustrated Worlds of Spice cover: silver pinball, chrome returns and a desert worm",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Worlds of Spice",
    description: "A desert pinball odyssey.",
    images: ["./og-v3.png"],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#102c3a",
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
