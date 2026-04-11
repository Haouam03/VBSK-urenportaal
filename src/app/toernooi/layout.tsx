import type { Metadata, Viewport } from "next";
import "./arcade.css";

export const metadata: Metadata = {
  title: "PING PONG TOERNOOI",
  description: "Multiplayer pingpongtoernooi – arcade style",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function TournamentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-arcade-black text-white font-body relative overflow-x-hidden">
      {/* CRT scanline overlay */}
      <div className="crt-overlay" />
      {children}
    </div>
  );
}
