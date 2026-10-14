import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Matchlight — Get in the game.",
  description:
    "A bilingual spectator companion that makes scores, key moments, and what to watch next easier to understand. ENGR 170 Team 4 demo.",
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
