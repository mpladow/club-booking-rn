// File: src/hooks/use-bookings.tsx
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
} from "react";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";
import {
  bookingsRepository,
  CURRENT_USER_ID,
  today,
  validDraft,
  type Booking,
  type BookingDraft,
} from "@/data/bookings";
interface BookingsState {
  bookings: Booking[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  failNext: boolean;
  setFailNext: (value: boolean) => void;
  refresh: () => Promise<void>;
  submit: (draft: BookingDraft) => void;
}
const Context = createContext<BookingsState | null>(null);
export const BookingsProvider = ({
  children,
}: {
  children: ReactNode;
}): ReactElement => {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [failNext, setFailNext] = useState<boolean>(false);
  const transient = useRef<Booking[]>([]);
  const sequence = useRef<number>(0);
  const revision = useRef<number>(0);
  const refresh = async (): Promise<void> => {
    setRefreshing(true);
    try {
      const startedAt = revision.current;
      const saved = await bookingsRepository.list();
      if (startedAt !== revision.current) {
        await refresh();
        return;
      }
      const merged = new Map<string, Booking>(
        [...saved, ...transient.current].map(
          (b: Booking): [string, Booking] => [b.id, b],
        ),
      );
      setBookings(
        [...merged.values()]
          .filter((b: Booking): boolean => b.date >= today())
          .sort((a: Booking, b: Booking): number =>
            b.createdAt.localeCompare(a.createdAt),
          ),
      );
      setError(null);
    } catch {
      setError("Bookings could not be loaded. Pull down to try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };
  useEffect((): (() => void) => {
    let active = true;
    void bookingsRepository
      .list()
      .then((saved: Booking[]): void => {
        if (active) {
          const merged = new Map<string, Booking>(
            [...saved, ...transient.current].map(
              (b: Booking): [string, Booking] => [b.id, b],
            ),
          );
          setBookings(
            [...merged.values()]
              .filter((b: Booking): boolean => b.date >= today())
              .sort((a: Booking, b: Booking): number =>
                b.createdAt.localeCompare(a.createdAt),
              ),
          );
        }
      })
      .catch((): void => {
        if (active)
          setError("Bookings could not be loaded. Pull down to try again.");
      })
      .finally((): void => {
        if (active) setLoading(false);
      });
    return (): void => {
      active = false;
    };
  }, []);
  const submit = (draft: BookingDraft): void => {
    if (!validDraft(draft))
      throw new Error("Please check the booking details.");
    const booking: Booking = {
      ...draft,
      game: draft.game.trim(),
      id: `booking-${Date.now()}-${++sequence.current}`,
      userId: CURRENT_USER_ID,
      createdAt: new Date().toISOString(),
      status: "pending",
    };
    const shouldFail = __DEV__ && failNext;
    setFailNext(false);
    revision.current += 1;
    transient.current = [booking, ...transient.current];
    setBookings((current: Booking[]): Booking[] => [booking, ...current]);
    void (async (): Promise<void> => {
      try {
        await new Promise<void>((resolve: () => void): void => {
          setTimeout(resolve, 1800);
        });
        if (shouldFail) throw new Error("Simulated failure");
        await bookingsRepository.create(booking);
        revision.current += 1;
        transient.current = transient.current.map(
          (b: Booking): Booking =>
            b.id === booking.id ? { ...b, status: "confirmed" } : b,
        );
        setBookings((current: Booking[]): Booking[] =>
          current.map(
            (b: Booking): Booking =>
              b.id === booking.id ? { ...b, status: "confirmed" } : b,
          ),
        );
        if (Platform.OS !== "web")
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(
            (): void => {},
          );
      } catch {
        revision.current += 1;
        transient.current = transient.current.map(
          (b: Booking): Booking =>
            b.id === booking.id ? { ...b, status: "failed" } : b,
        );
        setBookings((current: Booking[]): Booking[] =>
          current.map(
            (b: Booking): Booking =>
              b.id === booking.id ? { ...b, status: "failed" } : b,
          ),
        );
      }
    })();
  };
  return (
    <Context.Provider
      value={{
        bookings,
        loading,
        refreshing,
        error,
        failNext,
        setFailNext,
        refresh,
        submit,
      }}
    >
      {children}
    </Context.Provider>
  );
};
export const useBookings = (): BookingsState => {
  const value = useContext(Context);
  if (!value) throw new Error("BookingsProvider is required");
  return value;
};
