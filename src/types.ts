export interface User {
  id: string;
  username: string;
  status: 'online' | 'offline' | 'ingame';
  wins: number;
}

export interface Game {
  id: string;
  players: string[];
  board: (string | null)[];
  turn: string;
  status: 'playing' | 'draw' | 'won';
  winner?: string;
  round: number;
  scores: Record<string, number>;
  rematchRequests: string[];
  seriesWinner?: string;
}

export type AuthStatus = 'unauthenticated' | 'authenticating' | 'authenticated';
