import type { Metadata, Viewport } from "next";
import "./globals.css";

// Favicon assets are vendored into public/ and served same-origin (see
// public/favicon.ico, favicon-32x32.png, favicon-180x180.png,
// apple-touch-icon.png). The `?v=3` query is a cache-buster: browsers key
// their favicon cache by exact URL, so bumping it forces a refetch after the
// icon changes instead of reusing a stale "no favicon" result.
const ICON_VERSION = "3";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
};

export const metadata: Metadata = {
  title: "NStarX Project Intake System",
  description: "Submit a request to Shantanu's queue.",
  icons: {
    icon: [
      { url: `/favicon.ico?v=${ICON_VERSION}`, sizes: "any" },
      {
        url: `/favicon-32x32.png?v=${ICON_VERSION}`,
        type: "image/png",
        sizes: "32x32",
      },
      {
        url: `/favicon-180x180.png?v=${ICON_VERSION}`,
        type: "image/png",
        sizes: "180x180",
      },
    ],
    shortcut: [`/favicon.ico?v=${ICON_VERSION}`],
    apple: [
      {
        url: `/apple-touch-icon.png?v=${ICON_VERSION}`,
        type: "image/png",
        sizes: "180x180",
      },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-brand-zebra text-brand-ink antialiased">
        {children}
      </body>
    </html>
  );
}
