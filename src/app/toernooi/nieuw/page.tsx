"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

function generateRoomCode(): string {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

export default function NieuwToernooi() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleCreate() {
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Voer je naam in!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Generate unique room code
      let roomCode = generateRoomCode();
      let attempts = 0;

      while (attempts < 10) {
        const { data: existing } = await supabase
          .from("tournaments")
          .select("id")
          .eq("room_code", roomCode)
          .single();

        if (!existing) break;
        roomCode = generateRoomCode();
        attempts++;
      }

      // Create tournament
      const hostId = crypto.randomUUID();
      const { data: tournament, error: tournamentError } = await supabase
        .from("tournaments")
        .insert({
          room_code: roomCode,
          host_id: hostId,
          status: "lobby",
        })
        .select()
        .single();

      if (tournamentError) throw tournamentError;

      // Add host as first player
      const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({
          tournament_id: tournament.id,
          name: trimmed,
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // Store host info locally
      localStorage.setItem(
        `tournament_${roomCode}`,
        JSON.stringify({
          tournamentId: tournament.id,
          playerId: player.id,
          hostId: hostId,
          playerName: trimmed,
          isHost: true,
        })
      );

      router.push(`/toernooi/lobby/${roomCode}`);
    } catch (err) {
      console.error(err);
      setError("Kon toernooi niet aanmaken. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="font-display text-lg neon-green mb-12">NIEUW TOERNOOI</h1>

      <div className="w-full max-w-xs flex flex-col gap-6">
        <div>
          <label className="font-display text-xs text-arcade-cyan block mb-3">
            JOUW NAAM
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            placeholder="Naam..."
            maxLength={20}
            className="arcade-input"
            autoFocus
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="font-body text-lg text-arcade-pink text-center">
            {error}
          </p>
        )}

        <button
          onClick={handleCreate}
          disabled={loading || !name.trim()}
          className="arcade-btn arcade-btn-green w-full"
        >
          {loading ? "LADEN..." : "START!"}
        </button>

        <button
          onClick={() => router.push("/toernooi")}
          className="arcade-btn arcade-btn-pink w-full"
        >
          TERUG
        </button>
      </div>
    </div>
  );
}
