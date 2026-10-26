// File: src/data/bookings.ts
import { openDatabaseAsync, type SQLiteDatabase } from "expo-sqlite";
export const CURRENT_USER_ID = "demo-current-user";
export const TABLES: readonly number[] = [1, 2, 3, 4];
export interface BookingDraft {
  date: string;
  table: number;
  game: string;
  spectators: boolean;
  demo: boolean;
}
export interface Booking extends BookingDraft {
  id: string;
  userId: string;
  createdAt: string;
  status: "pending" | "confirmed" | "failed";
}
export interface BookingsRepository {
  list: () => Promise<Booking[]>;
  create: (booking: Booking) => Promise<void>;
}
export const today = (): string =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Australia/Sydney",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
export const dateLabel = (date: string): string =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-AU", {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
export const validDraft = (draft: BookingDraft): boolean =>
  /^\d{4}-\d{2}-\d{2}$/.test(draft.date) &&
  draft.date >= today() &&
  TABLES.includes(draft.table) &&
  draft.game.length <= 50;
let database: Promise<SQLiteDatabase> | undefined;
const initialize = async (): Promise<SQLiteDatabase> => {
  const db = await openDatabaseAsync("club-bookings.db");
  // Versioned mock storage is isolated from the future API contract.
  const version = await db.getFirstAsync<{ user_version: number }>(
    "PRAGMA user_version",
  );
  if ((version?.user_version ?? 0) < 1) {
    await db.withTransactionAsync(async (): Promise<void> => {
      await db.execAsync(
        "CREATE TABLE IF NOT EXISTS mock_bookings (id TEXT PRIMARY KEY NOT NULL, user_id TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL)",
      );
      const seeds: Booking[] = [
        {
          id: "seed-mine",
          userId: CURRENT_USER_ID,
          date: today(),
          table: 1,
          game: "Board games",
          spectators: true,
          demo: false,
          status: "confirmed",
          createdAt: new Date().toISOString(),
        },
        {
          id: "seed-other",
          userId: "demo-other-user",
          date: today(),
          table: 3,
          game: "Chess",
          spectators: false,
          demo: true,
          status: "confirmed",
          createdAt: new Date().toISOString(),
        },
      ];
      for (const booking of seeds)
        await db.runAsync(
          "INSERT OR IGNORE INTO mock_bookings VALUES (?, ?, ?, ?)",
          booking.id,
          booking.userId,
          booking.createdAt,
          JSON.stringify(booking),
        );
      await db.execAsync("PRAGMA user_version = 1");
    });
  }
  return db;
};
const getDatabase = async (): Promise<SQLiteDatabase> => {
  database ??= initialize().catch((error: unknown): never => {
    database = undefined;
    throw error;
  });
  return database;
};
export const bookingsRepository: BookingsRepository = {
  list: async (): Promise<Booking[]> => {
    const db = await getDatabase();
    const rows = await db.getAllAsync<{ payload: string }>(
      "SELECT payload FROM mock_bookings WHERE user_id = ? ORDER BY created_at DESC",
      CURRENT_USER_ID,
    );
    return rows
      .map(
        (row: { payload: string }): Booking =>
          JSON.parse(row.payload) as Booking,
      )
      .filter((booking: Booking): boolean => booking.date >= today());
  },
  create: async (booking: Booking): Promise<void> => {
    const db = await getDatabase();
    await db.runAsync(
      "INSERT INTO mock_bookings VALUES (?, ?, ?, ?)",
      booking.id,
      booking.userId,
      booking.createdAt,
      JSON.stringify({ ...booking, status: "confirmed" }),
    );
  },
};
