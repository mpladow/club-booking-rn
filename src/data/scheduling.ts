// File: src/data/scheduling.ts
// Mirrors ClubBooking/docs/contracts/scheduling.ts. UTC instants are server-owned.
import { authService } from "./auth-service";
import { ApiError, type ApiResource, type ResourceRequest } from "./api-auth";
import { validDate } from "./administration";
export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export type Weekday = typeof WEEKDAYS[number];
export type ScheduleKind = "recurring" | "single";
export interface WeeklyScheduleDetails {
  id: string; clubId: string; timeZoneId: string; weekday: Weekday; startTime: string; endTime: string;
  scheduleStartDate: string; scheduleEndDate: string | null; name: string | null; description: string | null;
}
export interface TimeslotDetails {
  id: string; clubId: string; recurringScheduleId: string | null; localSessionDate: string; timeZoneId: string;
  startTime: string; endTime: string; name: string | null; description: string | null;
  startsAtUtc: string; endsAtUtc: string; occurrenceType: "Recurring" | "Customised" | "Additional";
  closedAtUtc: string | null; closedByUserId: string | null; revision: number;
}
export type ScheduleDetails = WeeklyScheduleDetails | TimeslotDetails;
export interface Versioned<T> { value: T; etag: string }
interface SessionInput { name: string | null; description: string | null; startTime: string; endTime: string }
export interface WeeklyScheduleUpdate extends SessionInput { weekday: Weekday; scheduleStartDate: string; scheduleEndDate: string | null }
export interface TimeslotUpdate extends SessionInput { localSessionDate: string }
export interface ScheduleDraft {
  name: string; description: string; weekday: Weekday; startTime: string; endTime: string;
  scheduleStartDate: string; scheduleEndDate: string; localSessionDate: string;
}
export type ScheduleErrors = Partial<Record<keyof ScheduleDraft, string>>;
export const TIME_OPTIONS: readonly string[] = Array.from({ length: 96 }, (_: unknown, i: number): string =>
  `${String(Math.floor(i / 4)).padStart(2, "0")}:${String((i % 4) * 15).padStart(2, "0")}:00`);
export const emptyDraft = (date: string): ScheduleDraft => ({ name: "", description: "", weekday: WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()], startTime: "18:00:00", endTime: "21:00:00", scheduleStartDate: date, scheduleEndDate: "", localSessionDate: date });
export const draftFrom = (value: ScheduleDetails, today: string): ScheduleDraft => ({
  ...emptyDraft(today), name: value.name ?? "", description: value.description ?? "", startTime: value.startTime, endTime: value.endTime,
  ...("weekday" in value ? { weekday: value.weekday, scheduleStartDate: today, scheduleEndDate: value.scheduleEndDate ?? "" }
    : { localSessionDate: value.localSessionDate }),
});
export const displayName = (value: ScheduleDetails): string => value.name?.trim() || ("occurrenceType" in value && value.occurrenceType === "Additional" ? "Additional Session" : "Regular Session");
export const savedDraft = (value: ScheduleDetails): ScheduleDraft => ({ ...draftFrom(value, "weekday" in value ? value.scheduleStartDate : value.localSessionDate), name: displayName(value) });
export const editableTimeslot = (value: TimeslotDetails, now: number = Date.now()): boolean => !value.closedAtUtc && Date.parse(value.startsAtUtc) > now;
export const localClock = (zone: string, now: Date = new Date()): string => new Intl.DateTimeFormat("en-GB", { timeZone: zone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" }).format(now);
export const validateSchedule = (input: ScheduleDraft, kind: ScheduleKind, today: string, clock: string, commencement: string): ScheduleErrors => {
  const errors: ScheduleErrors = {};
  if (!TIME_OPTIONS.includes(input.startTime)) errors.startTime = "Choose a start time in 15 minute increments.";
  if (!TIME_OPTIONS.includes(input.endTime) || input.endTime <= input.startTime) errors.endTime = "Choose an end time after the start time on the same day.";
  const date: string = kind === "recurring" ? input.scheduleStartDate : input.localSessionDate;
  const key: "scheduleStartDate" | "localSessionDate" = kind === "recurring" ? "scheduleStartDate" : "localSessionDate";
  if (!validDate(date) || date < today || date < commencement) errors[key] = "Choose today or a future date on or after the club commencement date.";
  if (kind === "single" && date === today && input.startTime <= clock) errors.startTime = "The session must start in the future in the club timezone.";
  if (kind === "recurring") {
    if (!WEEKDAYS.includes(input.weekday)) errors.weekday = "Choose a weekday.";
    if (input.scheduleEndDate && (!validDate(input.scheduleEndDate) || input.scheduleEndDate < date)) errors.scheduleEndDate = "End of Schedule must be on or after Apply changes from.";
  }
  return errors;
};
export const schedulePayload = (input: ScheduleDraft, kind: ScheduleKind): WeeklyScheduleUpdate | TimeslotUpdate => ({
  name: input.name.trim() || null, description: input.description.trim() || null, startTime: input.startTime, endTime: input.endTime,
  ...(kind === "recurring" ? { weekday: input.weekday, scheduleStartDate: input.scheduleStartDate, scheduleEndDate: input.scheduleEndDate || null } : { localSessionDate: input.localSessionDate }),
});
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const textOrNull = (value: unknown): boolean => value === null || typeof value === "string";
const fail = (): never => { throw new Error("Scheduling returned invalid details. Refresh and try again."); };
const time = (value: unknown): boolean => typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value);
export const parseSchedule = (value: unknown, kind: ScheduleKind): ScheduleDetails => {
  if (!record(value) || typeof value.id !== "string" || typeof value.clubId !== "string" || typeof value.timeZoneId !== "string"
    || !time(value.startTime) || !time(value.endTime) || !textOrNull(value.name) || !textOrNull(value.description)) return fail();
  if (kind === "recurring") {
    if (!WEEKDAYS.includes(value.weekday as Weekday) || !validDate(value.scheduleStartDate) || !(value.scheduleEndDate === null || validDate(value.scheduleEndDate))) return fail();
  } else if (!validDate(value.localSessionDate) || !textOrNull(value.recurringScheduleId) || !textOrNull(value.closedAtUtc) || !textOrNull(value.closedByUserId)
    || !["Recurring", "Customised", "Additional"].includes(String(value.occurrenceType)) || !Number.isInteger(value.revision)
    || typeof value.startsAtUtc !== "string" || !Number.isFinite(Date.parse(value.startsAtUtc)) || typeof value.endsAtUtc !== "string" || !Number.isFinite(Date.parse(value.endsAtUtc))) return fail();
  return value as unknown as ScheduleDetails;
};
const versioned = (response: ApiResource, kind: ScheduleKind): Versioned<ScheduleDetails> => {
  // A missing/exposed-header CORS configuration must never permit an unversioned write.
  if (!response.etag || !/^"[^"\r\n]+"$/.test(response.etag)) throw new Error("The service did not expose a valid ETag. Refresh or ask the API administrator to expose the ETag response header.");
  return { value: parseSchedule(response.value, kind), etag: response.etag };
};
const path = (club: string, kind: ScheduleKind, id?: string): string => {
  const guid = /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i;
  if (!guid.test(club) || (id !== undefined && !guid.test(id))) throw new Error("The club or schedule is unavailable.");
  return `/clubs/${club}/${kind === "recurring" ? "schedules" : "timeslots"}${id === undefined ? "" : `/${id}`}`;
};
interface SchedulingApi { resource: (path: string, options?: ResourceRequest) => Promise<ApiResource> }
export const createSchedulingService = (api: SchedulingApi): {
  list: (club: string) => Promise<WeeklyScheduleDetails[]>;
  timeslots: (club: string, from: string, to: string) => Promise<TimeslotDetails[]>;
  details: (club: string, kind: ScheduleKind, id: string) => Promise<Versioned<ScheduleDetails>>;
  save: (club: string, kind: ScheduleKind, draft: ScheduleDraft, existing?: { id: string; etag: string }) => Promise<Versioned<ScheduleDetails>>;
  remove: (club: string, kind: ScheduleKind, id: string, etag: string) => Promise<void>;
} => ({
  list: async (club: string): Promise<WeeklyScheduleDetails[]> => {
    const response: ApiResource = await api.resource(path(club, "recurring"));
    if (!Array.isArray(response.value)) return fail();
    return response.value.map((v: unknown): WeeklyScheduleDetails => parseSchedule(v, "recurring") as WeeklyScheduleDetails);
  },
  timeslots: async (club: string, from: string, to: string): Promise<TimeslotDetails[]> => {
    if (!validDate(from) || !validDate(to) || to < from) throw new Error("Choose a valid calendar month.");
    const response: ApiResource = await api.resource(`${path(club, "single").replace("/timeslots", "/administration/timeslots")}?fromDate=${from}&toDate=${to}&includeClosed=false`);
    if (!Array.isArray(response.value)) return fail();
    return response.value.map((v: unknown): TimeslotDetails => parseSchedule(v, "single") as TimeslotDetails);
  },
  details: async (club: string, kind: ScheduleKind, id: string): Promise<Versioned<ScheduleDetails>> => versioned(await api.resource(path(club, kind, id)), kind),
  save: async (club: string, kind: ScheduleKind, draft: ScheduleDraft, existing?: { id: string; etag: string }): Promise<Versioned<ScheduleDetails>> => {
    if (existing && !existing.etag) throw new Error("Reload the latest details before saving.");
    return versioned(await api.resource(path(club, kind, existing?.id), { method: existing ? "PUT" : "POST", body: schedulePayload(draft, kind), ifMatch: existing?.etag }), kind);
  },
  remove: async (club: string, kind: ScheduleKind, id: string, etag: string): Promise<void> => {
    if (!etag) throw new Error("Reload the latest details before deleting.");
    await api.resource(path(club, kind, id), { method: "DELETE", ifMatch: etag });
  },
});
export const schedulingService = createSchedulingService(authService);
export const schedulingError = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.status === 412) return "Someone changed this item. Reload the latest details and reconcile your draft before confirming again.";
    if (error.status === 428) return "Reload the latest details before trying again.";
    if (error.status === 404) return "This schedule or timeslot is no longer available. Return to Schedule and refresh.";
    if (error.status === 403) return "You no longer have permission for this action.";
    if (error.serverCode?.includes("ActiveBookings")) return "Pending or confirmed bookings prevent this change. Resolve those bookings before trying again. Your draft is preserved.";
    if (error.serverCode?.includes("Overlap")) return "This overlaps an existing schedule or timeslot. Choose another date or time.";
    if (["NonexistentLocalTime", "AmbiguousLocalTime"].includes(error.serverCode ?? "")) return "This time is invalid or ambiguous because of daylight saving in the club timezone. Choose another time.";
    if (["TimeslotAlreadyStarted", "TimeslotClosed"].includes(error.serverCode ?? "")) return "This session has started or is closed and is read-only. Reload its latest details.";
    if (error.serverCode === "RecurringDateIsFixed") return "An occurrence belonging to a recurring schedule cannot move to another date.";
    if (["InvalidSessionDate", "TimeslotWouldStartInPast"].includes(error.serverCode ?? "")) return "Sessions must start in the future and on or after the club commencement date.";
    if (error.status === 409) return "The API could not apply this change because of a scheduling conflict. Your draft is preserved. Refresh the latest details before trying again.";
  }
  return error instanceof Error ? error.message : "The request could not be completed. Try again.";
};
export const monthRange = (month: string): { from: string; to: string } => ({ from: `${month}-01`, to: `${month}-${new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate()}` });
export const moveMonth = (month: string, amount: number): string => {
  const value: Date = new Date(`${month}-15T12:00:00Z`); value.setUTCMonth(value.getUTCMonth() + amount); return value.toISOString().slice(0, 7);
};
export const sortSchedules = (values: readonly WeeklyScheduleDetails[], date: string, showExpired: boolean): WeeklyScheduleDetails[] => values.filter((v: WeeklyScheduleDetails): boolean => showExpired || !v.scheduleEndDate || v.scheduleEndDate >= date)
  .sort((a: WeeklyScheduleDetails, b: WeeklyScheduleDetails): number => WEEKDAYS.indexOf(a.weekday) - WEEKDAYS.indexOf(b.weekday) || a.startTime.localeCompare(b.startTime));
