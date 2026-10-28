// File: src/data/bookings.ts
import { authService } from "./auth-service";
import { gameSelectionError, OTHER_GAME_ID, type GameSelection } from "./game-selection";

export interface BookingDraft extends GameSelection {
  requestId: string;
  timeslotId: string;
  tableId: string;
  date: string;
  table: string;
  startsAtUtc: string;
  endsAtUtc: string;
  spectators: boolean;
  demo: boolean;
}
export interface Timeslot {
  id: string;
  date: string;
  startsAtUtc: string;
  endsAtUtc: string;
}
export interface AvailableTable { id: string; name: string; size: string }
export interface BookingClub { id: string; name: string; timeZoneId: string }
export type BookingStatus = "Pending" | "Confirmed" | "Rejected" | "CancellationPending" | "Cancelled" | "Completed";
export interface Booking {
  id: string;
  requestId: string;
  timeslotId: string;
  tableId: string;
  tableName: string;
  gameId: string | null;
  gameName: string | null;
  spectators: boolean;
  demoGame: boolean;
  status: BookingStatus;
  failureCode: string | null;
  canRetry: boolean;
  startsAtUtc: string;
  endsAtUtc: string;
}
interface BookingApi {
  get: (path: string) => Promise<unknown>;
  post: (path: string, body: object) => Promise<unknown>;
}
interface BookingsService {
  club: (clubId: string) => Promise<BookingClub>;
  timeslots: (clubId: string) => Promise<Timeslot[]>;
  tables: (clubId: string, timeslotId: string) => Promise<AvailableTable[]>;
  list: (clubId: string) => Promise<Booking[]>;
  get: (clubId: string, bookingId: string) => Promise<Booking>;
  create: (clubId: string, draft: BookingDraft) => Promise<Booking>;
}
export const isGuid = (value: unknown): value is string => typeof value === "string"
  && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value)
  && value !== "00000000-0000-0000-0000-000000000000";
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const isDateTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
export const today = (timeZone: string = "Australia/Sydney"): string => new Intl.DateTimeFormat("en-CA", {
  timeZone, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date());
export const dateLabel = (date: string): string => new Date(`${date}T12:00:00`).toLocaleDateString("en-AU", {
  weekday: "short", day: "numeric", month: "long", year: "numeric",
});
export const bookingDate = (booking: Booking, timeZone: string): string => new Intl.DateTimeFormat("en-CA", {
  timeZone, year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(booking.startsAtUtc));
export const sessionLabel = (session: { startsAtUtc: string; endsAtUtc: string }, timeZone: string): string => {
  const format = new Intl.DateTimeFormat("en-AU", { timeZone, hour: "numeric", minute: "2-digit" });
  return `${format.format(new Date(session.startsAtUtc))} – ${format.format(new Date(session.endsAtUtc))}`;
};
// This non-secret command UUID remains unchanged for transport retries.
export const createRequestId = (): string => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (digit: string): string => {
  const random: number = Math.floor(Math.random() * 16);
  return (digit === "x" ? random : (random & 3) | 8).toString(16);
});
export const validDraft = (draft: BookingDraft): boolean => isGuid(draft.requestId) && isGuid(draft.timeslotId)
  && isGuid(draft.tableId) && isGuid(draft.gameId) && /^\d{4}-\d{2}-\d{2}$/.test(draft.date)
  && isDateTime(draft.startsAtUtc) && isDateTime(draft.endsAtUtc) && gameSelectionError(draft) === null;
export const processingBooking = (booking: Booking): boolean => booking.status === "Pending" || booking.status === "CancellationPending";
const parseBooking = (value: unknown): Booking => {
  if (!isRecord(value) || !isGuid(value.id) || !isGuid(value.requestId) || !isGuid(value.timeslotId)
    || !isGuid(value.tableId) || typeof value.tableName !== "string"
    || !(value.gameId === null || isGuid(value.gameId)) || !(value.gameName === null || typeof value.gameName === "string")
    || typeof value.spectators !== "boolean" || typeof value.demoGame !== "boolean" || typeof value.canRetry !== "boolean"
    || !(value.failureCode === null || typeof value.failureCode === "string")
    || !["Pending", "Confirmed", "Rejected", "CancellationPending", "Cancelled", "Completed"].includes(String(value.status))
    || !isDateTime(value.startsAtUtc) || !isDateTime(value.endsAtUtc))
    throw new Error("The booking service returned invalid booking details. Please refresh and try again.");
  return value as unknown as Booking;
};
const parseList = <T,>(value: unknown, parse: (item: unknown) => T): T[] => {
  if (!Array.isArray(value)) throw new Error("The booking service returned an invalid list. Please try again.");
  return value.map(parse);
};
const clubPath = (clubId: string): string => {
  if (!isGuid(clubId)) throw new Error("No club is selected. Sign in again to book a table.");
  return `/clubs/${clubId}`;
};
export const bookingErrorMessage = (error: unknown): string => {
  const code: unknown = isRecord(error) ? error.serverCode : null;
  switch (code) {
    case "TableUnavailable": return "That table was just booked. Go back and choose another table.";
    case "BookingLimitReached": return "You have reached your booking limit for this session.";
    case "RequestIdReused": return "This request was already used for different details. Review your booking and try again.";
    case "OtherGameNameRequired": return "Enter a game name of 200 characters or fewer.";
    case "GameRequired": case "GameNotFound": return "Choose a game again before submitting.";
    case "OutsideBookingWindow": case "TimeslotUnavailable": return "This session is no longer bookable. Choose another date.";
    default: return error instanceof Error ? error.message : "The booking could not be submitted. Please try again.";
  }
};
export const createBookingsService = (api: BookingApi): BookingsService => ({
  club: async (clubId: string): Promise<BookingClub> => {
    const value: unknown = await api.get(clubPath(clubId));
    if (!isRecord(value) || !isGuid(value.id) || typeof value.name !== "string" || typeof value.timeZoneId !== "string")
      throw new Error("Club details could not be loaded. Please try again.");
    new Intl.DateTimeFormat("en-AU", { timeZone: value.timeZoneId });
    return { id: value.id, name: value.name, timeZoneId: value.timeZoneId };
  },
  timeslots: async (clubId: string): Promise<Timeslot[]> => parseList(await api.get(`${clubPath(clubId)}/timeslots`), (value: unknown): Timeslot => {
    if (!isRecord(value) || !isGuid(value.id) || typeof value.date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)
      || !isDateTime(value.startsAtUtc) || !isDateTime(value.endsAtUtc)) throw new Error("Available dates could not be loaded.");
    return { id: value.id, date: value.date, startsAtUtc: value.startsAtUtc, endsAtUtc: value.endsAtUtc };
  }),
  tables: async (clubId: string, timeslotId: string): Promise<AvailableTable[]> => {
    if (!isGuid(timeslotId)) throw new Error("Choose a session first.");
    return parseList(await api.get(`${clubPath(clubId)}/timeslots/${timeslotId}/tables`), (value: unknown): AvailableTable => {
      if (!isRecord(value) || !isGuid(value.id) || typeof value.name !== "string" || typeof value.size !== "string")
        throw new Error("Available tables could not be loaded.");
      return { id: value.id, name: value.name, size: value.size };
    });
  },
  list: async (clubId: string): Promise<Booking[]> => parseList(await api.get(`${clubPath(clubId)}/bookings`), parseBooking),
  get: async (clubId: string, bookingId: string): Promise<Booking> => {
    if (!isGuid(bookingId)) throw new Error("Invalid booking.");
    return parseBooking(await api.get(`${clubPath(clubId)}/bookings/${bookingId}`));
  },
  create: async (clubId: string, draft: BookingDraft): Promise<Booking> => {
    if (!validDraft(draft)) throw new Error("Check your date, table and game before confirming.");
    return parseBooking(await api.post(`${clubPath(clubId)}/bookings`, {
      requestId: draft.requestId, timeslotId: draft.timeslotId, tableId: draft.tableId,
      gameId: draft.gameId, spectators: draft.spectators, demoGame: draft.demo,
      ...(draft.gameId === OTHER_GAME_ID ? { otherGameName: draft.otherGameName.trim() } : {}),
    }));
  },
});
export const bookingsService = createBookingsService(authService);
