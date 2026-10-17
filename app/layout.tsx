import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NStarX Project Intake System",
  description: "Submit a request to Shantanu's queue.",
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
