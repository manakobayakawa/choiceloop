import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ChoiceLoop · Café Athena",
  description: "Don't just optimize for being found. Optimize for being chosen. An evidence-led AI growth experiment workspace.",
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
