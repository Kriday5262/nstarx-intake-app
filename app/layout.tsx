import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NStarX Project Intake System",
  description: "Submit a request to Shantanu's queue.",
  icons: {
    icon: "https://nstarxinc.com/wp-content/uploads/2024/10/cropped-favicon-180x180.png",
    shortcut:
      "https://nstarxinc.com/wp-content/uploads/2024/10/cropped-favicon-180x180.png",
    apple:
      "https://nstarxinc.com/wp-content/uploads/2024/10/cropped-favicon-180x180.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="icon"
          type="image/png"
          href="https://nstarxinc.com/wp-content/uploads/2024/10/cropped-favicon-180x180.png"
        />
        <link
          rel="shortcut icon"
          type="image/png"
          href="https://nstarxinc.com/wp-content/uploads/2024/10/cropped-favicon-180x180.png"
        />
        <link
          rel="apple-touch-icon"
          href="https://nstarxinc.com/wp-content/uploads/2024/10/cropped-favicon-180x180.png"
        />
      </head>
      <body className="min-h-screen flex flex-col bg-brand-zebra text-brand-ink antialiased">
        {children}
      </body>
    </html>
  );
}
