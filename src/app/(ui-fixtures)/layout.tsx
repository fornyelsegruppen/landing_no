import type { Metadata, Viewport } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Takfornyelse Admin Next Visual Fixture",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f3f5f7",
};

export default function UiFixtureRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className="min-h-full bg-[#f3f5f7]" lang="lt">
      <body className="min-h-dvh bg-[#f3f5f7] antialiased">{children}</body>
    </html>
  );
}
