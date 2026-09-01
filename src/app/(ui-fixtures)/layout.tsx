import type { Metadata, Viewport } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Takfornyelse Admin Next Visual Fixture",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#080c11",
};

export default function UiFixtureRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className="min-h-full bg-[#080c11]" lang="lt">
      <body className="min-h-dvh bg-[#080c11] antialiased">{children}</body>
    </html>
  );
}
