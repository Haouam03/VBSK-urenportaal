"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

interface Confetti {
  id: number;
  left: number;
  color: string;
  delay: number;
  duration: number;
  size: number;
}

function generateConfetti(): Confetti[] {
  const colors = ["#39ff14", "#00fff7", "#ff2d95", "#ffe600", "#b026ff", "#ff6600"];
  const pieces: Confetti[] = [];
  for (let i = 0; i < 40; i++) {
    pieces.push({
      id: i,
      left: Math.random() * 100,
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 3,
      duration: 2 + Math.random() * 3,
      size: 6 + Math.random() * 10,
    });
  }
  return pieces;
}

export default function KampioenScreen() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [champion, setChampion] = useState<string | null>(null);
  const [confetti] = useState<Confetti[]>(() => generateConfetti());
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);

  const loadChampion = useCallback(async () => {
    const stored = localStorage.getItem(`tournament_${code}`);
    if (stored) {
      const data = JSON.parse(stored);
      setIsHost(data.isHost);
    }

    const { data: tournament } = await supabase
      .from("tournaments")
      .select("champion, status")
      .eq("room_code", code)
      .single();

    if (tournament?.champion) {
      setChampion(tournament.champion);
    }

    setLoading(false);
  }, [code]);

  useEffect(() => {
    loadChampion();
  }, [loadChampion]);

  // Listen for champion updates
  useEffect(() => {
    const channel = supabase
      .channel(`champion_${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `room_code=eq.${code}`,
        },
        (payload) => {
          const updated = payload.new as { champion: string | null; status: string };
          if (updated.champion) {
            setChampion(updated.champion);
          }
          // If reset to lobby, go back
          if (updated.status === "lobby") {
            router.push(`/toernooi/lobby/${code}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code, router]);

  async function handleNewTournament() {
    router.push("/toernooi");
  }

  async function handleViewBracket() {
    router.push(`/toernooi/bracket/${code}`);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-display text-sm neon-cyan animate-glow-pulse">
          LADEN...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Confetti */}
      {confetti.map((piece) => (
        <div
          key={piece.id}
          className="confetti-piece"
          style={{
            left: `${piece.left}%`,
            backgroundColor: piece.color,
            width: `${piece.size}px`,
            height: `${piece.size}px`,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
            borderRadius: Math.random() > 0.5 ? "50%" : "0",
          }}
        />
      ))}

      {/* Trophy */}
      <div className="text-8xl trophy-animate mb-8">🏆</div>

      {/* Champion title */}
      <h1 className="font-display text-lg neon-yellow text-center mb-4">
        KAMPIOEN!
      </h1>

      {/* Champion name */}
      <div className="text-center mb-12">
        <p className="font-display text-2xl neon-green animate-glow-pulse">
          {champion || "???"}
        </p>
      </div>

      {/* Decorative stars */}
      <div className="flex gap-4 mb-12 text-2xl">
        <span className="animate-glow-pulse" style={{ animationDelay: "0s" }}>⭐</span>
        <span className="animate-glow-pulse" style={{ animationDelay: "0.3s" }}>⭐</span>
        <span className="animate-glow-pulse" style={{ animationDelay: "0.6s" }}>⭐</span>
      </div>

      {/* Victory message */}
      <p className="font-body text-2xl neon-cyan text-center mb-12">
        {champion} wint het toernooi!
      </p>

      {/* Actions */}
      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={handleViewBracket}
          className="arcade-btn arcade-btn-cyan w-full"
        >
          BEKIJK BRACKET
        </button>

        {isHost && (
          <button
            onClick={handleNewTournament}
            className="arcade-btn arcade-btn-green w-full"
          >
            NIEUW TOERNOOI
          </button>
        )}
      </div>

      {/* Insert coin */}
      <div className="mt-12">
        <p className="font-display text-xs neon-pink insert-coin">
          GAME OVER
        </p>
      </div>
    </div>
  );
}
