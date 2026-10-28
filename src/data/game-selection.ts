// File: src/data/game-selection.ts
export const OTHER_GAME_ID: string = "61af7d36-2b80-4c9f-a314-000000000003";
export const GAME_NAME_MAX_LENGTH: number = 200;

export interface Game {
  id: string;
  name: string;
  ordering: number;
}

export interface GameSelection {
  gameId: string;
  game: string;
  otherGameName: string;
}

export const gameSelectionError = ({ gameId, otherGameName }: GameSelection): string | null => {
  if (!gameId) return "Choose a game.";
  if (gameId === OTHER_GAME_ID && !otherGameName.trim()) return "Enter your game name.";
  if (gameId === OTHER_GAME_ID && otherGameName.trim().length > GAME_NAME_MAX_LENGTH)
    return `Use ${GAME_NAME_MAX_LENGTH} characters or fewer.`;
  if (gameId !== OTHER_GAME_ID && otherGameName) return "Choose your game again.";
  return null;
};
