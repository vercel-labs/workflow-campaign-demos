import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Workflow DevKit Gallery — 30 Days of Patterns",
    template: "%s",
  },
  description:
    "Explore 50 workflow pattern demos. Search by scenario, browse by category, and run each demo live.",
  openGraph: {
    title: "Workflow DevKit Gallery — 30 Days of Patterns",
    description:
      "Explore 50 workflow pattern demos. Search by scenario, browse by category, and run each demo live.",
    siteName: "Workflow DevKit Gallery",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Workflow DevKit Gallery — 30 Days of Patterns",
    description:
      "Explore 50 workflow pattern demos. Search by scenario, browse by category, and run each demo live.",
  },
  metadataBase: new URL(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : "http://localhost:3000",
  ),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={{ colorScheme: "dark" }}>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-blue-700 focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-blue-700 focus:ring-offset-2"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
