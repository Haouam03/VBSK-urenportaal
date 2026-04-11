"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  Bracket,
  Match,
  setMatchScore,
  getChampion,
} from "@/lib/bracket";

interface LocalData {
  tournamentId: string;
  playerId: string;
  hostId: string | null;
  playerName: string;
  isHost: boolean;
}

interface ScoreEntry {
  matchId: string;
  score1: string;
  score2: string;
}

export default function BracketView() {
  const router = useRouter();
  const params = useParams();
  const code = params.code as string;

  const [bracket, setBracket] = useState<Bracket | null>(null);
  const [localData, setLocalData] = useState<LocalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [scoreEntry, setScoreEntry] = useState<ScoreEntry | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadBracket = useCallback(async () => {
    const stored = localStorage.getItem(`tournament_${code}`);
    if (!stored) {
      router.push("/toernooi");
      return;
    }

    const data = JSON.parse(stored) as LocalData;
    setLocalData(data);

    const { data: tournament } = await supabase
      .from("tournaments")
      .select("*")
      .eq("room_code", code)
      .single();

    if (tournament) {
      setBracket(tournament.bracket as Bracket);

      // Check if there's a champion
      if (tournament.status === "finished" && tournament.champion) {
        router.push(`/toernooi/kampioen/${code}`);
        return;
      }
    }

    setLoading(false);
  }, [code, router]);

  useEffect(() => {
    loadBracket();
  }, [loadBracket]);

  // Real-time subscription for bracket updates
  useEffect(() => {
    if (!localData) return;

    const channel = supabase
      .channel(`bracket_${code}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tournaments",
          filter: `room_code=eq.${code}`,
        },
        (payload) => {
          const updated = payload.new as {
            bracket: Bracket;
            status: string;
            champion: string | null;
          };
          setBracket(updated.bracket);

          if (updated.status === "finished" && updated.champion) {
            router.push(`/toernooi/kampioen/${code}`);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [localData, code, router]);

  async function handleScoreSubmit() {
    if (!scoreEntry || !bracket || !localData?.isHost) return;

    const s1 = parseInt(scoreEntry.score1);
    const s2 = parseInt(scoreEntry.score2);

    if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0) {
      setError("Voer geldige scores in!");
      return;
    }

    if (s1 === s2) {
      setError("Gelijke stand niet toegestaan!");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const updatedBracket = setMatchScore(bracket, scoreEntry.matchId, s1, s2);
      const champion = getChampion(updatedBracket);

      const updateData: Record<string, unknown> = {
        bracket: updatedBracket,
      };

      if (champion) {
        updateData.status = "finished";
        updateData.champion = champion;
      }

      const { error: updateError } = await supabase
        .from("tournaments")
        .update(updateData)
        .eq("id", localData.tournamentId);

      if (updateError) throw updateError;

      setBracket(updatedBracket);
      setScoreEntry(null);

      if (champion) {
        router.push(`/toernooi/kampioen/${code}`);
      }
    } catch (err) {
      console.error(err);
      setError("Kon score niet opslaan.");
    } finally {
      setSubmitting(false);
    }
  }

  function isMatchPlayable(match: Match): boolean {
    return (
      match.player1 !== null &&
      match.player2 !== null &&
      match.winner === null &&
      // Not a BYE match
      !(match.player1 === null || match.player2 === null)
    );
  }

  function openScoreEntry(match: Match) {
    if (!localData?.isHost || !isMatchPlayable(match)) return;
    setScoreEntry({
      matchId: match.id,
      score1: "",
      score2: "",
    });
    setError("");
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

  if (!bracket) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="font-display text-sm text-arcade-pink">
          GEEN BRACKET GEVONDEN
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="font-display text-sm neon-green mb-2">BRACKET</h1>
        <p className="font-display text-xs text-gray-500">CODE: {code}</p>
      </div>

      {/* Score entry modal */}
      {scoreEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4">
          <div className="bg-arcade-dark border-2 border-arcade-cyan p-6 w-full max-w-sm">
            <h2 className="font-display text-xs neon-cyan text-center mb-6">
              SCORE INVOEREN
            </h2>

            {(() => {
              // Find the match to show player names
              let match: Match | null = null;
              for (const round of bracket.rounds) {
                for (const m of round.matches) {
                  if (m.id === scoreEntry.matchId) {
                    match = m;
                    break;
                  }
                }
              }

              if (!match) return null;

              return (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-body text-xl text-arcade-green flex-1 truncate">
                      {match.player1}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={scoreEntry.score1}
                      onChange={(e) =>
                        setScoreEntry({ ...scoreEntry, score1: e.target.value })
                      }
                      className="score-input"
                      autoFocus
                    />
                  </div>

                  <div className="text-center font-display text-xs text-gray-500">
                    VS
                  </div>

                  <div className="flex items-center justify-between gap-4">
                    <span className="font-body text-xl text-arcade-green flex-1 truncate">
                      {match.player2}
                    </span>
                    <input
                      type="number"
                      inputMode="numeric"
                      min="0"
                      value={scoreEntry.score2}
                      onChange={(e) =>
                        setScoreEntry({ ...scoreEntry, score2: e.target.value })
                      }
                      className="score-input"
                    />
                  </div>

                  {error && (
                    <p className="font-body text-lg text-arcade-pink text-center">
                      {error}
                    </p>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => {
                        setScoreEntry(null);
                        setError("");
                      }}
                      className="arcade-btn arcade-btn-pink flex-1"
                    >
                      ANNULEER
                    </button>
                    <button
                      onClick={handleScoreSubmit}
                      disabled={submitting}
                      className="arcade-btn arcade-btn-green flex-1"
                    >
                      {submitting ? "..." : "OPSLAAN"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Bracket rounds */}
      <div className="flex-1 overflow-x-auto arcade-scroll">
        <div className="flex gap-6 min-w-max pb-4">
          {bracket.rounds.map((round, roundIndex) => (
            <div key={roundIndex} className="flex flex-col gap-4 min-w-[200px]">
              {/* Round name */}
              <h2 className="font-display text-xs neon-cyan text-center mb-2">
                {round.name}
              </h2>

              {/* Matches with spacing for bracket alignment */}
              <div
                className="flex flex-col justify-around flex-1"
                style={{ gap: `${Math.pow(2, roundIndex) * 16}px` }}
              >
                {round.matches.map((match) => {
                  const isBye =
                    (match.player1 && !match.player2) ||
                    (!match.player1 && match.player2);
                  const isComplete = match.winner !== null;
                  const playable = isMatchPlayable(match);

                  return (
                    <div
                      key={match.id}
                      onClick={() => openScoreEntry(match)}
                      className={`match-card rounded transition-all ${
                        isComplete ? "match-card-winner" : ""
                      } ${
                        playable && localData?.isHost
                          ? "cursor-pointer hover:border-arcade-yellow hover:shadow-[0_0_10px_rgba(255,230,0,0.3)]"
                          : ""
                      }`}
                    >
                      {/* Player 1 */}
                      <div
                        className={`flex items-center justify-between py-1 ${
                          match.winner === match.player1 && match.player1
                            ? "text-arcade-green"
                            : match.winner && match.winner !== match.player1
                            ? "text-gray-600 line-through"
                            : "text-white"
                        }`}
                      >
                        <span className="font-body text-lg truncate max-w-[120px]">
                          {match.player1 || (isBye ? "—" : "...")}
                        </span>
                        {match.score1 !== null && !isBye && (
                          <span className="font-display text-xs ml-2">
                            {match.score1}
                          </span>
                        )}
                      </div>

                      {/* Divider */}
                      <div className="border-t border-gray-700 my-1" />

                      {/* Player 2 */}
                      <div
                        className={`flex items-center justify-between py-1 ${
                          match.winner === match.player2 && match.player2
                            ? "text-arcade-green"
                            : match.winner && match.winner !== match.player2
                            ? "text-gray-600 line-through"
                            : "text-white"
                        }`}
                      >
                        <span className="font-body text-lg truncate max-w-[120px]">
                          {match.player2 || (isBye ? "BYE" : "...")}
                        </span>
                        {match.score2 !== null && !isBye && (
                          <span className="font-display text-xs ml-2">
                            {match.score2}
                          </span>
                        )}
                      </div>

                      {/* Playable indicator for host */}
                      {playable && localData?.isHost && (
                        <div className="text-center mt-1">
                          <span className="font-display text-[8px] text-arcade-yellow insert-coin">
                            TAP OM SCORE IN TE VOEREN
                          </span>
                        </div>
                      )}

                      {/* BYE indicator */}
                      {isBye && (
                        <div className="text-center mt-1">
                          <span className="font-display text-[8px] text-gray-600">
                            BYE
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Host instruction */}
      {localData?.isHost && (
        <div className="text-center mt-4 pt-4 border-t border-gray-800">
          <p className="font-body text-sm text-gray-500">
            Tap op een wedstrijd om de score in te voeren
          </p>
        </div>
      )}
    </div>
  );
}
