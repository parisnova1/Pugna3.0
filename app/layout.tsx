import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { DEFAULT_OG_IMAGE, SITE_DESCRIPTION, SITE_NAME, siteUrl } from "@/lib/seo";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl()),
  title: { default: "Pugna — Train. Match. Compete. Track.", template: "%s | PUGNA" },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: { siteName: SITE_NAME, type: "website", locale: "en_US", images: [{ url: DEFAULT_OG_IMAGE }] },
  twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={geist.variable}>
      <body className="bg-void text-ink font-sans min-h-screen">{children}</body>
    </html>
  );
}
