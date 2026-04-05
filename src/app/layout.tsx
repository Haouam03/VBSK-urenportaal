import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "VBSK Amsterdam - Urenregistratie",
  description: "Urenregistratieportaal voor boksvereniging VBSK Amsterdam",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="nl">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
