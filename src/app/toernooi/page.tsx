"use client";

import Link from "next/link";

export default function TitleScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      {/* Bouncing ball */}
      <div className="w-full max-w-xs mb-8">
        <div className="ball-bounce">
          <div className="w-4 h-4 rounded-full bg-white shadow-[0_0_10px_#fff,0_0_20px_#fff]" />
        </div>
      </div>

      {/* Title */}
      <div className="text-center mb-12">
        <h1 className="font-display text-2xl sm:text-3xl neon-cyan leading-relaxed mb-2">
          PING PONG
        </h1>
        <h1 className="font-display text-2xl sm:text-3xl neon-pink leading-relaxed">
          TOERNOOI
        </h1>
      </div>

      {/* Decorative paddle */}
      <div className="flex items-center gap-4 mb-12 text-4xl">
        <span>🏓</span>
      </div>

      {/* Menu options */}
      <div className="flex flex-col gap-6 w-full max-w-xs">
        <Link href="/toernooi/nieuw">
          <button className="arcade-btn arcade-btn-green w-full">
            NIEUW TOERNOOI
          </button>
        </Link>
        <Link href="/toernooi/join">
          <button className="arcade-btn arcade-btn-cyan w-full">
            JOIN TOERNOOI
          </button>
        </Link>
      </div>

      {/* Insert coin */}
      <div className="mt-16">
        <p className="font-display text-xs neon-yellow insert-coin">
          INSERT COIN
        </p>
      </div>

      {/* Credits */}
      <div className="absolute bottom-4 text-center">
        <p className="font-body text-sm text-gray-600">
          © 2026 VBSK ARCADE
        </p>
      </div>
    </div>
  );
}
