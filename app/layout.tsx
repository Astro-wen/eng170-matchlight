import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matchlight — Snap the game. See more.",
  description:
    "A camera-first spectator prototype: take a photo, explore on-photo information, and understand the moment.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
