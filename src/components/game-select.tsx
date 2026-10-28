// File: src/components/game-select.tsx
import { useEffect, useState, type ReactElement } from "react";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { GAME_NAME_MAX_LENGTH, OTHER_GAME_ID, type Game, type GameSelection } from "@/data/game-selection";
import { loadGames } from "@/data/games";

export const GameSelect = ({ value, onChange }: {
  value: GameSelection;
  onChange: (selection: GameSelection) => void;
}): ReactElement => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [failed, setFailed] = useState<boolean>(false);
  const [attempt, setAttempt] = useState<number>(0);
  const [expanded, setExpanded] = useState<boolean>(false);

  useEffect((): (() => void) => {
    let active: boolean = true;
    void loadGames().then((result: Game[]): void => {
      if (active) setGames(result);
    }).catch((): void => {
      if (active) setFailed(true);
    }).finally((): void => {
      if (active) setLoading(false);
    });
    return (): void => { active = false; };
  }, [attempt]);

  const other: boolean = value.gameId === OTHER_GAME_ID;
  const label: string = other ? "Other" : value.game || "Select a game";
  return (
    <View className="gap-2">
      <Text nativeID="game-label" className="text-base font-medium text-neutral-900">
        What game are you playing?
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`What game are you playing? ${label}`}
        accessibilityHint="Opens the game dropdown"
        accessibilityState={{ expanded, disabled: loading || failed, busy: loading }}
        disabled={loading || failed}
        onPress={(): void => setExpanded(!expanded)}
        className="min-h-12 flex-row items-center justify-between gap-4 rounded-xl border border-neutral-200 bg-white px-4 py-3 active:opacity-75 focus:border-indigo-600"
      >
        <Text className={`flex-1 text-base ${value.gameId ? "text-neutral-900" : "text-neutral-500"}`}>
          {loading ? "Loading games…" : label}
        </Text>
        <Text accessible={false} className="text-neutral-500">{expanded ? "▴" : "▾"}</Text>
      </Pressable>
      {failed && (
        <View className="gap-2">
          <Text accessibilityRole="alert" className="text-sm text-amber-700">
            Games could not be loaded. Check your connection and try again.
          </Text>
          <Button variant="outlined" onPress={(): void => {
            setLoading(true);
            setFailed(false);
            setAttempt(attempt + 1);
          }}>Retry games</Button>
        </View>
      )}
      {expanded && (
        <ScrollView
          accessibilityRole="radiogroup"
          accessibilityLabel="Games"
          className="max-h-64 rounded-xl border border-neutral-200 bg-white"
          nestedScrollEnabled
          keyboardShouldPersistTaps="handled"
        >
          {games.map((game: Game): ReactElement => (
            <Pressable
              key={game.id}
              accessibilityRole="radio"
              accessibilityLabel={game.name}
              accessibilityState={{ checked: value.gameId === game.id }}
              onPress={(): void => {
                // A catalogue selection must never carry a previous custom name.
                onChange({ gameId: game.id, game: game.id === OTHER_GAME_ID ? "" : game.name, otherGameName: "" });
                setExpanded(false);
              }}
              className={`min-h-12 justify-center px-4 py-3 active:opacity-75 focus:bg-indigo-50 ${value.gameId === game.id ? "bg-indigo-50" : ""}`}
            >
              <Text className={`text-base ${value.gameId === game.id ? "font-semibold text-indigo-600" : "text-neutral-900"}`}>
                {game.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
      {other && (
        <View className="gap-2">
          <Text className="text-base font-medium text-neutral-900">Game name</Text>
          <TextInput
            accessibilityLabel="Custom game name"
            placeholder="Enter your game name"
            value={value.otherGameName}
            onChangeText={(otherGameName: string): void => onChange({ ...value, otherGameName, game: otherGameName.trim() })}
            maxLength={GAME_NAME_MAX_LENGTH}
            className="min-h-12 rounded-xl border border-neutral-200 bg-white px-4 py-3 text-base text-neutral-900 focus:border-indigo-600"
          />
          <Text className="text-sm text-neutral-500">{value.otherGameName.length}/{GAME_NAME_MAX_LENGTH}</Text>
        </View>
      )}
    </View>
  );
};
