// File: src/hooks/use-bookings.tsx
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import * as Haptics from "expo-haptics";
import { AppState, Platform } from "react-native";
import { bookingErrorMessage, bookingsService, processingBooking, type Booking, type BookingClub, type BookingDraft } from "@/data/bookings";

interface BookingsState {
  bookings: Booking[];
  club: BookingClub | null;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  submit: (draft: BookingDraft) => Promise<void>;
}
const Context = createContext<BookingsState | null>(null);
export const BookingsProvider = ({ children, clubId }: {
  children: ReactNode;
  clubId: string | null;
}): ReactElement => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [club, setClub] = useState<BookingClub | null>(null);
  const [loading, setLoading] = useState<boolean>(Boolean(clubId));
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef<Booking[]>([]);
  const active = useRef<boolean>(true);
  const revision = useRef<number>(0);
  const fetching = useRef<Promise<void> | null>(null);
  const publish = useCallback((next: Booking[]): void => {
    latest.current = next;
    setBookings(next);
  }, []);

  const load = useCallback(async (): Promise<void> => {
    if (!clubId) return;
    if (fetching.current) return fetching.current;
    const pending: Promise<void> = (async (): Promise<void> => {
      const started: number = revision.current;
      const processing: Booking[] = latest.current.filter(processingBooking);
      const [saved, updates] = await Promise.all([
        bookingsService.list(clubId),
        Promise.all(processing.map((booking: Booking): Promise<Booking> => bookingsService.get(clubId, booking.id))),
      ]);
      if (!active.current || started !== revision.current) return;
      // Terminal rejections disappear from the active list, so retain polled outcomes in this session.
      const merged = new Map<string, Booking>(saved.map((booking: Booking): [string, Booking] => [booking.id, booking]));
      for (const booking of latest.current.filter((item: Booking): boolean => item.status === "Rejected")) merged.set(booking.id, booking);
      for (const booking of updates) merged.set(booking.id, booking);
      publish([...merged.values()]);
      setError(null);
    })();
    fetching.current = pending;
    try { await pending; } finally { if (fetching.current === pending) fetching.current = null; }
  }, [clubId, publish]);

  useEffect((): (() => void) => {
    active.current = true;
    let cancelled: boolean = false;
    let foreground: boolean = AppState.currentState !== "background";
    let timer: ReturnType<typeof setTimeout> | undefined;
    const reload = async (): Promise<void> => {
      if (!clubId) return;
      try {
        const details: BookingClub = await bookingsService.club(clubId);
        if (!cancelled) setClub(details);
        await load();
      } catch (failure: unknown) {
        if (!cancelled) setError(bookingErrorMessage(failure));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    const poll = async (): Promise<void> => {
      if (cancelled) return;
      if (foreground && latest.current.some(processingBooking)) {
        try { await load(); } catch {
          if (!cancelled) setError("Booking status could not be checked. Pull down to retry; your reservation may still be processing.");
        }
      }
      if (!cancelled) timer = setTimeout((): void => { void poll(); }, 2000);
    };
    if (clubId) void reload();
    timer = setTimeout((): void => { void poll(); }, 2000);
    const subscription = AppState.addEventListener("change", (state): void => {
      foreground = state === "active";
      if (foreground && !cancelled && clubId) void load().catch((): void => {
        if (!cancelled) setError("Bookings could not be refreshed. Pull down to retry.");
      });
    });
    return (): void => {
      cancelled = true;
      active.current = false;
      if (timer) clearTimeout(timer);
      subscription.remove();
    };
  }, [clubId, load]);

  const refresh = async (): Promise<void> => {
    if (!clubId) return;
    setRefreshing(true);
    try {
      const details: BookingClub = await bookingsService.club(clubId);
      if (active.current) setClub(details);
      await load();
    } catch (failure: unknown) {
      if (active.current) setError(bookingErrorMessage(failure));
    } finally {
      if (active.current) { setLoading(false); setRefreshing(false); }
    }
  };
  const submit = async (draft: BookingDraft): Promise<void> => {
    if (!clubId) throw new Error("No club is selected. Sign in again before booking.");
    const saved: Booking = await bookingsService.create(clubId, draft);
    if (!active.current) return;
    revision.current += 1;
    publish([saved, ...latest.current.filter((booking: Booking): boolean => booking.id !== saved.id)]);
    setError(null);
    if (Platform.OS !== "web") void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((): void => {});
  };
  return <Context.Provider value={{ bookings, club, loading, refreshing, error, refresh, submit }}>{children}</Context.Provider>;
};
export const useBookings = (): BookingsState => {
  const value: BookingsState | null = useContext(Context);
  if (!value) throw new Error("BookingsProvider is required");
  return value;
};
