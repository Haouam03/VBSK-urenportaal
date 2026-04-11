"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { generateBracket } from "@/lib/bracket";

interface Player {
  id: string;
  name: string;
  created_at: string;
}

interface LocalData {
  tournamentId: string;
  playerId: string;
  hostId: string | null;
  playerName: string;
  isHost: boolean;
}

export default function Lobby() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [players, setPlayers] = useState<Player[]>([]);
  const [localData, setLocalData] = useState<LocalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  const loadData = useCallback(async () => {
    const stored = localStorage.getItem(`tournament_${code}`);
    if (!stored) {
      router.push("/toernooi");
      return;
    }

    const data = JSON.parse(stored) as LocalData;
    setLocalData(data);

    // Load current players
    const { data: playerList } = await supabase
      .from("players")
      .select("*")
      .eq("tournament_id", data.tournamentId)
      .order("created_at", { ascending: true });

    if (playerList) {
      setPlayers(playerList);
    }

    setLoading(false);
  }, [code, router]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time subscription for new players
  useEffect(() => {
    if (!localData) return;

    const channel = supabase
      .channel(`lobby_${code}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `tournament_id=eq.${localData.tournamentId}`,
        },
        () => {
          // Reload players on any change
          supabase
            .from("players")
            .select("*")
            .eq("tournament_id", localData.tournamentId)
            .order("created_at", { ascending: true })
            .then(({ data }) => {
              if (data) setPlayers(data);
            });
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `room_code=eq.${code}`,
        },
        (payload) => {
          // If tournament status changed to active, go to bracket
          if (payload.new && (payload.new as { status: string }).status === "active") {
            router.push(`/toernooi/bracket/${code}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [localData, code, router]);

  async function handleStart() {
    if (!localData?.isHost || players.length < 2) return;

    setStarting(true);
    setError("");

    try {
      const playerNames = players.map((p) => p.name);
      const bracket = generateBracket(playerNames);

      const { error: updateError } = await supabase
        .from("tournaments")
        .update({
          status: "active",
          bracket: bracket,
        })
        .eq("id", localData.tournamentId);

      if (updateError) throw updateError;

      router.push(`/toernooi/bracket/${code}`);
    } catch (err) {
      console.error(err);
      setError("Kon toernooi niet starten.");
      setStarting(false);
    }
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
    <div className="min-h-screen flex flex-col items-center px-4 py-8">
      {/* Header */}
      <h1 className="font-display text-sm neon-green mb-6">LOBBY</h1>

      {/* Room code */}
      <div className="text-center mb-8">
        <p className="font-display text-xs text-gray-500 mb-2">ROOMCODE</p>
        <p className="room-code-display">{code}</p>
        <p className="font-body text-sm text-gray-500 mt-2">
          Deel deze code met andere spelers
        </p>
      </div>

      {/* Player count */}
      <div className="mb-4">
        <p className="font-display text-xs neon-cyan">
          SPELERS: {players.length}
        </p>
      </div>

      {/* Player list */}
      <div className="w-full max-w-xs border border-arcade-green/30 mb-8">
        {players.map((player, index) => (
          <div key={player.id} className="player-item flex items-center gap-3">
            <span className="font-display text-xs text-arcade-yellow">
              {index + 1}.
            </span>
            <span>{player.name}</span>
            {localData && player.id === localData.playerId && (
              <span className="text-arcade-pink text-sm ml-auto">(JIJ)</span>
            )}
            {index === 0 && (
              <span className="text-arcade-yellow text-sm ml-auto">★ HOST</span>
            )}
          </div>
        ))}

        {players.length === 0 && (
          <div className="player-item text-gray-600 text-center">
            Wachten op spelers...
          </div>
        )}
      </div>

      {/* Waiting animation */}
      <div className="mb-8">
        <p className="font-display text-xs text-arcade-yellow insert-coin">
          WACHTEN OP SPELERS...
        </p>
      </div>

      {error && (
        <p className="font-body text-lg text-arcade-pink text-center mb-4">
          {error}
        </p>
      )}

      {/* Start button (host only) */}
      {localData?.isHost && (
        <button
          onClick={handleStart}
          disabled={players.length < 2 || starting}
          className="arcade-btn arcade-btn-yellow w-full max-w-xs"
        >
          {starting
            ? "STARTEN..."
            : players.length < 2
            ? "MIN. 2 SPELERS"
            : "START TOERNOOI!"}
        </button>
      )}

      {!localData?.isHost && (
        <p className="font-body text-lg text-gray-500 text-center">
          Wacht tot de host het toernooi start...
        </p>
      )}
    </div>
  );
}
