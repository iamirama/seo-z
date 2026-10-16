import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SEO Auditor — Professional SEO Audit & Analysis",
  description: "Comprehensive SEO audit platform: technical crawler, Core Web Vitals, on-page analysis, backlinks, and downloadable HTML reports.",
  keywords: ["SEO audit", "Core Web Vitals", "PageSpeed Insights", "Lighthouse", "Search Console", "Bing Webmaster", "Ahrefs", "Semrush", "Moz", "backlinks"],
  authors: [{ name: "Z-SEO-Auditor" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "SEO Auditor",
    description: "Professional SEO audit & analysis with downloadable HTML reports.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SEO Auditor",
    description: "Professional SEO audit & analysis with downloadable HTML reports.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
