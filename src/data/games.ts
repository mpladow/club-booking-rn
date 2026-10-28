// File: src/data/games.ts
import { authService } from "./auth-service";
import { OTHER_GAME_ID, type Game } from "./game-selection";

const isGame = (value: unknown): value is Game => {
  if (typeof value !== "object" || value === null) return false;
  const game = value as Record<string, unknown>;
  return typeof game.id === "string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(game.id)
    && typeof game.name === "string" && Boolean(game.name.trim())
    && typeof game.ordering === "number" && Number.isFinite(game.ordering);
};

// The API filters VisibleInUI. Keep its ordering and the reserved Other option last.
export const loadGames = async (): Promise<Game[]> => {
  const result: unknown = await authService.get("/games");
  if (!Array.isArray(result) || !result.length || !result.every(isGame))
    throw new Error("The game list is unavailable. Please try again.");
  const games: Game[] = result.map((game: Game): Game => ({ ...game, id: game.id.toLowerCase() }));
  return games.sort((a: Game, b: Game): number =>
    Number(a.id === OTHER_GAME_ID) - Number(b.id === OTHER_GAME_ID)
    || a.ordering - b.ordering || a.name.localeCompare(b.name));
};
