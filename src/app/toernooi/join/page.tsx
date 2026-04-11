"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function JoinToernooi() {
  const router = useRouter();
  const [roomCode, setRoomCode] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function handleCodeChange(value: string) {
    // Only allow digits, max 4
    const digits = value.replace(/\D/g, "").slice(0, 4);
    setRoomCode(digits);
  }

  async function handleJoin() {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Voer je naam in!");
      return;
    }
    if (roomCode.length !== 4) {
      setError("Voer een 4-cijferige code in!");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Find tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from("tournaments")
        .select("*")
        .eq("room_code", roomCode)
        .single();

      if (tournamentError || !tournament) {
        setError("Toernooi niet gevonden!");
        setLoading(false);
        return;
      }

      if (tournament.status !== "lobby") {
        setError("Toernooi is al begonnen!");
        setLoading(false);
        return;
      }

      // Check for duplicate name
      const { data: existingPlayers } = await supabase
        .from("players")
        .select("name")
        .eq("tournament_id", tournament.id);

      if (existingPlayers?.some((p) => p.name.toLowerCase() === trimmedName.toLowerCase())) {
        setError("Deze naam is al in gebruik!");
        setLoading(false);
        return;
      }

      // Add player
      const { data: player, error: playerError } = await supabase
        .from("players")
        .insert({
          tournament_id: tournament.id,
          name: trimmedName,
        })
        .select()
        .single();

      if (playerError) throw playerError;

      // Store player info locally
      localStorage.setItem(
        `tournament_${roomCode}`,
        JSON.stringify({
          tournamentId: tournament.id,
          playerId: player.id,
          hostId: null,
          playerName: trimmedName,
          isHost: false,
        })
      );

      router.push(`/toernooi/lobby/${roomCode}`);
    } catch (err) {
      console.error(err);
      setError("Kon niet joinen. Probeer opnieuw.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <h1 className="font-display text-lg neon-cyan mb-12">JOIN TOERNOOI</h1>

      <div className="w-full max-w-xs flex flex-col gap-6">
        <div>
          <label className="font-display text-xs text-arcade-yellow block mb-3">
            ROOMCODE
          </label>
          <input
            type="tel"
            inputMode="numeric"
            value={roomCode}
            onChange={(e) => handleCodeChange(e.target.value)}
            placeholder="0000"
            maxLength={4}
            className="arcade-input room-code-input mx-auto block"
            autoFocus
            autoComplete="off"
          />
        </div>

        <div>
          <label className="font-display text-xs text-arcade-cyan block mb-3">
            JOUW NAAM
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleJoin()}
            placeholder="Naam..."
            maxLength={20}
            className="arcade-input"
            autoComplete="off"
          />
        </div>

        {error && (
          <p className="font-body text-lg text-arcade-pink text-center">
            {error}
          </p>
        )}

        <button
          onClick={handleJoin}
          disabled={loading || !name.trim() || roomCode.length !== 4}
          className="arcade-btn arcade-btn-green w-full"
        >
          {loading ? "LADEN..." : "JOIN!"}
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
