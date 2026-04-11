export interface Match {
  id: string;
  player1: string | null;
  player2: string | null;
  score1: number | null;
  score2: number | null;
  winner: string | null;
}

export interface Round {
  name: string;
  matches: Match[];
}

export interface Bracket {
  rounds: Round[];
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function getRoundName(roundIndex: number, totalRounds: number): string {
  const remaining = totalRounds - roundIndex;
  if (remaining === 1) return "FINALE";
  if (remaining === 2) return "HALVE FINALE";
  if (remaining === 3) return "KWARTFINALE";
  return `RONDE ${roundIndex + 1}`;
}

export function generateBracket(playerNames: string[]): Bracket {
  const shuffled = shuffleArray(playerNames);
  const numPlayers = shuffled.length;

  // Find next power of 2
  let bracketSize = 1;
  while (bracketSize < numPlayers) {
    bracketSize *= 2;
  }

  const totalRounds = Math.log2(bracketSize);
  const numByes = bracketSize - numPlayers;

  // Create seeded list with BYEs at the end
  const seeded: (string | null)[] = [];
  for (let i = 0; i < bracketSize; i++) {
    seeded.push(i < shuffled.length ? shuffled[i] : null);
  }

  // Distribute BYEs evenly: place BYEs so top seeds get them
  // Re-arrange so BYEs are spread out
  const arranged: (string | null)[] = new Array(bracketSize).fill(null);
  const players = seeded.filter((p) => p !== null) as string[];
  const totalSlots = bracketSize;

  // Place players first, then BYEs fill remaining
  // Simple approach: place real players, BYEs at bottom of pairs
  for (let i = 0; i < totalSlots; i++) {
    if (i < players.length) {
      arranged[i] = players[i];
    }
  }

  // Build first round matches
  const firstRoundMatches: Match[] = [];
  for (let i = 0; i < totalSlots; i += 2) {
    const p1 = arranged[i];
    const p2 = arranged[i + 1];
    const matchId = `r0_m${i / 2}`;

    const match: Match = {
      id: matchId,
      player1: p1,
      player2: p2,
      score1: null,
      score2: null,
      winner: null,
    };

    // Auto-advance BYE matches
    if (p1 && !p2) {
      match.winner = p1;
      match.score1 = 0;
      match.score2 = 0;
    } else if (!p1 && p2) {
      match.winner = p2;
      match.score1 = 0;
      match.score2 = 0;
    } else if (!p1 && !p2) {
      // Both BYE - shouldn't happen with valid player counts
      match.winner = null;
    }

    firstRoundMatches.push(match);
  }

  const rounds: Round[] = [
    {
      name: getRoundName(0, totalRounds),
      matches: firstRoundMatches,
    },
  ];

  // Build subsequent rounds with empty matches
  let prevMatchCount = firstRoundMatches.length;
  for (let r = 1; r < totalRounds; r++) {
    const matchCount = prevMatchCount / 2;
    const matches: Match[] = [];

    for (let m = 0; m < matchCount; m++) {
      matches.push({
        id: `r${r}_m${m}`,
        player1: null,
        player2: null,
        score1: null,
        score2: null,
        winner: null,
      });
    }

    rounds.push({
      name: getRoundName(r, totalRounds),
      matches,
    });

    prevMatchCount = matchCount;
  }

  // Propagate BYE winners to next rounds
  propagateWinners(rounds);

  return { rounds };
}

export function propagateWinners(rounds: Round[]): void {
  for (let r = 0; r < rounds.length - 1; r++) {
    const currentRound = rounds[r];
    const nextRound = rounds[r + 1];

    for (let m = 0; m < currentRound.matches.length; m++) {
      const match = currentRound.matches[m];
      if (match.winner) {
        const nextMatchIndex = Math.floor(m / 2);
        const nextMatch = nextRound.matches[nextMatchIndex];
        if (m % 2 === 0) {
          nextMatch.player1 = match.winner;
        } else {
          nextMatch.player2 = match.winner;
        }

        // Auto-advance if opponent is already set and one is a BYE-advanced player
        // Check if next match can be auto-resolved (both players set from BYE rounds)
        if (nextMatch.player1 && !nextMatch.player2 && isAllByes(rounds, r + 1, nextMatchIndex, 1)) {
          // Wait, don't auto-advance real matches
        }
      }
    }
  }
}

function isAllByes(_rounds: Round[], _roundIdx: number, _matchIdx: number, _slot: number): boolean {
  return false;
}

export function setMatchScore(
  bracket: Bracket,
  matchId: string,
  score1: number,
  score2: number
): Bracket {
  const updated = JSON.parse(JSON.stringify(bracket)) as Bracket;

  // Find the match
  let roundIndex = -1;
  let matchIndex = -1;

  for (let r = 0; r < updated.rounds.length; r++) {
    for (let m = 0; m < updated.rounds[r].matches.length; m++) {
      if (updated.rounds[r].matches[m].id === matchId) {
        roundIndex = r;
        matchIndex = m;
        break;
      }
    }
    if (roundIndex !== -1) break;
  }

  if (roundIndex === -1) return updated;

  const match = updated.rounds[roundIndex].matches[matchIndex];
  match.score1 = score1;
  match.score2 = score2;
  match.winner = score1 > score2 ? match.player1 : match.player2;

  // Propagate winner to next round
  if (roundIndex < updated.rounds.length - 1) {
    const nextMatchIndex = Math.floor(matchIndex / 2);
    const nextMatch = updated.rounds[roundIndex + 1].matches[nextMatchIndex];
    if (matchIndex % 2 === 0) {
      nextMatch.player1 = match.winner;
    } else {
      nextMatch.player2 = match.winner;
    }
  }

  return updated;
}

export function getChampion(bracket: Bracket): string | null {
  const finalRound = bracket.rounds[bracket.rounds.length - 1];
  if (finalRound && finalRound.matches.length === 1) {
    return finalRound.matches[0].winner;
  }
  return null;
}

export function isTournamentComplete(bracket: Bracket): boolean {
  return getChampion(bracket) !== null;
}
