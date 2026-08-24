import type { Metadata, Viewport } from "next";
import "../globals.css";

export const metadata: Metadata = {
  title: "Takfornyelse Control",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c0e12",
};

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className="min-h-full bg-[#0c0e12] [color-scheme:dark]" lang="nb">
      <body className="min-h-dvh bg-[#0c0e12] text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
