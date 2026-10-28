// File: src/data/administration.ts
import { authService } from "./auth-service";
import { ApiError } from "./api-auth";
import { AuthError } from "./auth";

export const ADMIN_SECTIONS = ["adminClubDetails", "adminSchedules", "adminTables", "adminUsers"] as const;
export type AdminSection = typeof ADMIN_SECTIONS[number];
export interface SectionPermissions { view: boolean; edit: boolean; delete: boolean }
export interface AdministrationAccess {
  canAccessAdministration: boolean;
  permissions: Record<AdminSection, SectionPermissions>;
}
export interface ClubDetails {
  id: string; name: string; timeZoneId: string; commencementDate: string;
  bookingWindowDays: number; role: string; isPaidMember: boolean;
}
export interface ClubTable {
  id: string; name: string; size: "small" | "large"; availableFromDate: string; isEnabled: boolean;
}
export interface TableInput { name: string; size: "" | "small" | "large"; availableFromDate: string; isEnabled: boolean }
export type TableErrors = Partial<Record<keyof TableInput, string>>;
interface AdministrationApi {
  get: (path: string) => Promise<unknown>;
  post: (path: string, body: object) => Promise<unknown>;
  put: (path: string, body: object) => Promise<unknown>;
  delete: (path: string) => Promise<unknown>;
}
export interface AdministrationService {
  access: (clubId: string) => Promise<AdministrationAccess>;
  club: (clubId: string) => Promise<ClubDetails>;
  renameClub: (clubId: string, name: string) => Promise<ClubDetails>;
  tables: (clubId: string) => Promise<ClubTable[]>;
  table: (clubId: string, tableId: string) => Promise<ClubTable>;
  saveTable: (clubId: string, input: TableInput, tableId?: string) => Promise<ClubTable>;
  removeTable: (clubId: string, tableId: string) => Promise<void>;
}
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;
const guid = (value: unknown): value is string => typeof value === "string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value);
export const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value < "0001-01-01") return false;
  const date: Date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
};
const invalidResponse = (): never => { throw new Error("Administration returned invalid details. Please try again."); };
export const parseAccess = (value: unknown): AdministrationAccess => {
  if (!record(value) || typeof value.canAccessAdministration !== "boolean" || !record(value.permissions)) return invalidResponse();
  // Fail closed on malformed permissions; never infer grants from role names or tokens.
  for (const key of ADMIN_SECTIONS) {
    const grant: unknown = value.permissions[key];
    if (!record(grant) || typeof grant.view !== "boolean" || typeof grant.edit !== "boolean" || typeof grant.delete !== "boolean") return invalidResponse();
  }
  return value as unknown as AdministrationAccess;
};
const parseClub = (value: unknown): ClubDetails => {
  if (!record(value) || !guid(value.id) || typeof value.name !== "string" || typeof value.timeZoneId !== "string"
    || !validDate(value.commencementDate) || !Number.isInteger(value.bookingWindowDays) || typeof value.role !== "string"
    || typeof value.isPaidMember !== "boolean") return invalidResponse();
  return value as unknown as ClubDetails;
};
const parseTable = (value: unknown): ClubTable => {
  if (!record(value) || !guid(value.id) || typeof value.name !== "string" || !["small", "large"].includes(String(value.size))
    || !validDate(value.availableFromDate) || typeof value.isEnabled !== "boolean") return invalidResponse();
  return value as unknown as ClubTable;
};
const path = (clubId: string, tableId?: string): string => {
  if (!guid(clubId) || (tableId !== undefined && !guid(tableId))) throw new Error("The club or table is unavailable.");
  return `/clubs/${clubId}${tableId === undefined ? "" : `/tables/${tableId}`}`;
};
export const nameError = (name: string, limit: number): string | undefined =>
  !name.trim() || name.trim().length > limit ? `Enter a name of 1–${limit} characters.` : undefined;
export const validateTable = (input: TableInput): TableErrors => ({
  ...(nameError(input.name, 100) ? { name: nameError(input.name, 100) } : {}),
  ...(!["small", "large"].includes(input.size) ? { size: "Choose Small or Large." } : {}),
  ...(!validDate(input.availableFromDate) ? { availableFromDate: "Enter a valid date as YYYY-MM-DD." } : {}),
});
export const administrationErrorMessage = (error: unknown): string => {
  if (error instanceof ApiError) {
    if (error.serverCode === "TableNameInUse") return "A table already uses this name, including disabled tables. Choose another name.";
    if (error.serverCode === "TableHasActiveBookings") return "Active bookings prevent this change. Keep the table available for those bookings and try again.";
    if (error.serverCode === "ConcurrentChange") return "This table changed while your request was being processed. Review the latest details before trying again.";
    if (error.status === 404) return "This club or table is no longer available. Return to the list or try again.";
    if (error.status === 403) return "You no longer have permission for this action.";
  }
  return error instanceof Error ? error.message : "The request could not be completed. Please try again.";
};
export const sessionExpired = (error: unknown): boolean => error instanceof AuthError && error.code === "session-expired";
export const createAdministrationService = (api: AdministrationApi): AdministrationService => ({
  access: async (clubId: string): Promise<AdministrationAccess> => parseAccess(await api.get(`${path(clubId)}/administration/access`)),
  club: async (clubId: string): Promise<ClubDetails> => parseClub(await api.get(path(clubId))),
  renameClub: async (clubId: string, name: string): Promise<ClubDetails> => {
    const error: string | undefined = nameError(name, 200);
    if (error) throw new Error(error);
    return parseClub(await api.put(path(clubId), { name: name.trim() }));
  },
  tables: async (clubId: string): Promise<ClubTable[]> => {
    const value: unknown = await api.get(`${path(clubId)}/tables`);
    if (!Array.isArray(value)) return invalidResponse();
    return value.map(parseTable);
  },
  table: async (clubId: string, tableId: string): Promise<ClubTable> => parseTable(await api.get(path(clubId, tableId))),
  saveTable: async (clubId: string, input: TableInput, tableId?: string): Promise<ClubTable> => {
    if (Object.keys(validateTable(input)).length) throw new Error("Check the table details and try again.");
    // Explicit fields only: the API rejects unknown JSON properties. Server constraints arbitrate concurrent names/bookings.
    const body: object = { name: input.name.trim(), size: input.size, availableFromDate: input.availableFromDate, isEnabled: input.isEnabled };
    return parseTable(await (tableId ? api.put(path(clubId, tableId), body) : api.post(`${path(clubId)}/tables`, body)));
  },
  removeTable: async (clubId: string, tableId: string): Promise<void> => { await api.delete(path(clubId, tableId)); },
});
export const administrationService: AdministrationService = createAdministrationService(authService);
