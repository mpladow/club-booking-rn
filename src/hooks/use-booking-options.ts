// File: src/hooks/use-booking-options.ts
import { useEffect, useState } from "react";
import { bookingErrorMessage, bookingsService, type AvailableTable, type Timeslot } from "@/data/bookings";

interface Result<T> { key: string; values: T[]; error: string | null }
interface BookingOptions {
  timeslots: Timeslot[];
  tables: AvailableTable[];
  loadingDates: boolean;
  loadingTables: boolean;
  datesError: string | null;
  tablesError: string | null;
  retry: () => void;
}
export const useBookingOptions = (clubId: string | null, timeslotId: string): BookingOptions => {
  const [dates, setDates] = useState<Result<Timeslot> | null>(null);
  const [tables, setTables] = useState<Result<AvailableTable> | null>(null);
  const [attempt, setAttempt] = useState<number>(0);
  const datesKey: string = `${clubId}:${attempt}`;
  const tablesKey: string = `${clubId}:${timeslotId}:${attempt}`;
  useEffect((): (() => void) => {
    let active: boolean = true;
    if (clubId) void bookingsService.timeslots(clubId).then((values: Timeslot[]): void => {
      if (active) setDates({ key: datesKey, values, error: null });
    }).catch((failure: unknown): void => {
      if (active) setDates({ key: datesKey, values: [], error: bookingErrorMessage(failure) });
    });
    return (): void => { active = false; };
  }, [clubId, datesKey]);
  useEffect((): (() => void) => {
    let active: boolean = true;
    if (clubId && timeslotId) void bookingsService.tables(clubId, timeslotId).then((values: AvailableTable[]): void => {
      if (active) setTables({ key: tablesKey, values, error: null });
    }).catch((failure: unknown): void => {
      if (active) setTables({ key: tablesKey, values: [], error: bookingErrorMessage(failure) });
    });
    return (): void => { active = false; };
  }, [clubId, timeslotId, tablesKey]);
  // Stale results are hidden immediately when the session changes, before the next effect runs.
  const currentDates: Result<Timeslot> | null = dates?.key === datesKey ? dates : null;
  const currentTables: Result<AvailableTable> | null = tables?.key === tablesKey ? tables : null;
  return {
    timeslots: currentDates?.values ?? [], tables: currentTables?.values ?? [],
    loadingDates: Boolean(clubId && !currentDates), loadingTables: Boolean(clubId && timeslotId && !currentTables),
    datesError: currentDates?.error ?? null, tablesError: currentTables?.error ?? null,
    retry: (): void => setAttempt((current: number): number => current + 1),
  };
};
