// File: src/app/create-booking.tsx
import { Redirect, router, Stack, usePreventRemove } from "expo-router";
import { useEffect, useRef, useState, type ReactElement } from "react";
import {
  KeyboardAvoidingView,
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { BookingCalendar } from "@/components/booking-calendar";
import { GameSelect } from "@/components/game-select";
import { gameSelectionError } from "@/data/game-selection";
import { Button } from "@/components/ui/Button";
import {
  dateLabel,
  bookingErrorMessage,
  createRequestId,
  sessionLabel,
  today,
  validDraft,
  type BookingDraft,
  type AvailableTable,
  type Timeslot,
} from "@/data/bookings";
import { useBookings } from "@/hooks/use-bookings";
import { HeaderScrollInset } from "@/components/navigation-header";
import { ScreenHeading } from "@/components/screen-heading";
import { useScreenScroll } from "@/hooks/use-header-scroll";
import { useWideNavigation } from "@/hooks/use-wide-navigation";
import { useAuth } from "@/hooks/use-auth";
import { useBookingOptions } from "@/hooks/use-booking-options";
type Step = 0 | 1 | 2 | 3;
const TITLES: readonly string[] = [
  "Select date",
  "Select table",
  "Additional information",
  "Confirm booking",
];
const ToggleRow = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}): ReactElement => (
  <View className="flex-row items-center justify-between gap-4">
    <Text className="flex-1 text-base font-medium text-neutral-900">
      {label}
    </Text>
    <Switch accessibilityLabel={label} value={value} onValueChange={onChange} />
  </View>
);
const BookingForm = (): ReactElement => {
  const onScroll = useScreenScroll();
  const wide = useWideNavigation();
  const constrainContent: boolean = Platform.OS === "web" && wide;
  const { submit, club, loading, error: loadError, refresh } = useBookings();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>(0);
  const [draft, setDraft] = useState<BookingDraft>(() => ({
    requestId: createRequestId(),
    timeslotId: "",
    tableId: "",
    startsAtUtc: "",
    endsAtUtc: "",
    date: "",
    table: "",
    game: "",
    gameId: "",
    otherGameName: "",
    spectators: false,
    demo: false,
  }));
  const options = useBookingOptions(user?.clubId ?? null, draft.timeslotId);
  const [error, setError] = useState<string | null>(null);
  const [discard, setDiscard] = useState<boolean>(false);
  const [finished, setFinished] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const mounted = useRef<boolean>(true);
  useEffect((): (() => void) => {
    mounted.current = true;
    return (): void => { mounted.current = false; };
  }, []);
  const submitted = useRef<boolean>(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const disablePrevention = usePreventRemove(!finished, ({ repeat }): void => {
    if (submitted.current) return;
    pendingLeave.current = repeat;
    setDiscard(true);
  });
  const update = (patch: Partial<BookingDraft>): void => {
    setDraft(
      (current: BookingDraft): BookingDraft => ({ ...current, ...patch, requestId: createRequestId() }),
    );
    setError(null);
  };
  const next = (): boolean => {
    if (step === 0 && !options.timeslots.some((slot: Timeslot): boolean => slot.id === draft.timeslotId && slot.date === draft.date)) {
      setError("Choose an available date and session.");
      return false;
    }
    if (step === 1 && !options.tables.some((table: AvailableTable): boolean => table.id === draft.tableId)) {
      setError("Choose an available table.");
      return false;
    }
    const gameError: string | null = gameSelectionError(draft);
    if (step === 2 && gameError) {
      setError(gameError);
      return false;
    }
    setError(null);
    setStep((step + 1) as Step);
    return true;
  };
  const confirm = async (): Promise<boolean> => {
    if (submitted.current) return false;
    if (!validDraft(draft)) {
      setError("Check your date, table and game before confirming.");
      return false;
    }
    submitted.current = true;
    setSubmitting(true);
    setError(null);
    try {
      await submit({ ...draft, otherGameName: draft.otherGameName.trim() });
      if (!mounted.current) return false;
      setFinished(true);
      disablePrevention();
      router.replace("/");
    } catch (failure: unknown) {
      submitted.current = false;
      if (mounted.current) setError(bookingErrorMessage(failure));
    } finally {
      if (mounted.current) setSubmitting(false);
    }
    return false;
  };
  const leave = (): void => {
    setFinished(true);
    disablePrevention();
    setDiscard(false);
    if (pendingLeave.current) pendingLeave.current();
    else router.replace("/");
  };
  const summary: { label: string; value: string; step: Step }[] = [
    { label: "Date", value: draft.timeslotId && club ? `${dateLabel(draft.date)} · ${sessionLabel(draft, club.timeZoneId)}` : "Not selected", step: 0 },
    { label: "Table", value: draft.table, step: 1 },
    { label: "Game", value: draft.game.trim() || "Not specified", step: 2 },
    {
      label: "Spectators encouraged?",
      value: draft.spectators ? "Yes" : "No",
      step: 2,
    },
    { label: "Demo Game", value: draft.demo ? "Yes" : "No", step: 2 },
  ];
  return (
    <SafeAreaView
      edges={["bottom", "left", "right"]}
      className="min-h-0 flex-1 bg-neutral-50"
    >
      <Stack.Screen options={{ gestureEnabled: false, title: TITLES[step] }} />
      <KeyboardAvoidingView
        className="min-h-0 flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          className={`min-h-0 flex-1 ${constrainContent ? "" : "px-5"}`}
          keyboardShouldPersistTaps="handled"
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        >
          <View className={constrainContent ? "w-screen" : undefined}>
            <View className={constrainContent ? "mx-auto w-full max-w-6xl px-5" : undefined}>
              <HeaderScrollInset />
              <ScreenHeading title={TITLES[step]} />
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-neutral-500">
                  Step {step + 1} of 4
                </Text>
                <Button variant="text" disabled={submitting} onPress={(): void => setDiscard(true)}>
                  Close
                </Button>
              </View>
              <View className="mb-6 flex-row gap-2">
                {TITLES.map(
                  (title: string, index: number): ReactElement => (
                    <View
                      key={title}
                      className={`h-1 flex-1 rounded-full ${index <= step ? "bg-indigo-600" : "bg-neutral-200"}`}
                    />
                  ),
                )}
              </View>
              {!user?.clubId && <Text accessibilityRole="alert" className="mb-4 text-sm text-amber-700">No club is selected for your account. Sign in again with a club membership before booking.</Text>}
              {loading && <ActivityIndicator accessibilityLabel="Loading club" />}
              {loadError && !club && (
                <View className="mb-4 gap-2">
                  <Text accessibilityRole="alert" className="text-sm text-amber-700">{loadError}</Text>
                  <Button variant="outlined" onPress={refresh}>Retry club</Button>
                </View>
              )}
              {step === 0 && club && (
                <View className="gap-4">
                {options.loadingDates && <ActivityIndicator accessibilityLabel="Loading available dates" />}
                {options.datesError && <Text accessibilityRole="alert" className="text-sm text-amber-700">{options.datesError}</Text>}
                {!options.loadingDates && !options.datesError && !options.timeslots.length && <Text className="text-base text-neutral-500">There are no bookable sessions available.</Text>}
                <Button variant="text" disabled={options.loadingDates} onPress={options.retry}>Refresh available dates</Button>
                <BookingCalendar
                  value={draft.date}
                  earliestDate={today(club.timeZoneId)}
                  availableDates={options.timeslots.map((slot: Timeslot): string => slot.date)}
                  onChange={(date: string): void => {
                    const sessions: Timeslot[] = options.timeslots.filter((slot: Timeslot): boolean => slot.date === date);
                    const selected: Timeslot | undefined = sessions.length === 1 ? sessions[0] : undefined;
                    update({ date, timeslotId: selected?.id ?? "", startsAtUtc: selected?.startsAtUtc ?? "", endsAtUtc: selected?.endsAtUtc ?? "", tableId: "", table: "" });
                  }}
                />
                {options.timeslots.filter((slot: Timeslot): boolean => slot.date === draft.date).map((slot: Timeslot): ReactElement => (
                  <Button key={slot.id} variant={slot.id === draft.timeslotId ? "toggle-active" : "toggle-inactive"}
                    onPress={(): void => update({ timeslotId: slot.id, startsAtUtc: slot.startsAtUtc, endsAtUtc: slot.endsAtUtc, tableId: "", table: "" })}>
                    {sessionLabel(slot, club.timeZoneId)}
                  </Button>
                ))}
                </View>
              )}
              {step === 1 && (
                <View className="gap-4">
                  {options.loadingTables && <ActivityIndicator accessibilityLabel="Loading available tables" />}
                  {options.tablesError && <Text accessibilityRole="alert" className="text-sm text-amber-700">{options.tablesError}</Text>}
                  {!options.loadingTables && !options.tablesError && !options.tables.length && <Text className="text-base text-neutral-500">No tables are available for this session.</Text>}
                  <Button variant="text" disabled={options.loadingTables} onPress={options.retry}>Refresh available tables</Button>
                  {options.tables.map(
                    (table: AvailableTable): ReactElement => (
                      <Button
                        key={table.id}
                        variant={
                          draft.tableId === table.id
                            ? "toggle-active"
                            : "toggle-inactive"
                        }
                        onPress={(): void => update({ tableId: table.id, table: table.name })}
                      >{table.name}</Button>
                    ),
                  )}
                </View>
              )}
              {step === 2 && (
                <View className="gap-6">
                  <GameSelect value={draft} onChange={update} />
                  <ToggleRow
                    label="Spectators encouraged?"
                    value={draft.spectators}
                    onChange={(spectators: boolean): void => update({ spectators })}
                  />
                  <ToggleRow
                    label="Demo Game"
                    value={draft.demo}
                    onChange={(demo: boolean): void => update({ demo })}
                  />
                </View>
              )}
              {step === 3 && (
                <View className="rounded-xl border border-neutral-200 bg-white px-4">
                  {summary.map(
                    (row: {
                      label: string;
                      value: string;
                      step: Step;
                    }): ReactElement => (
                      <Pressable
                        key={row.label}
                        disabled={submitting}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${row.label}: ${row.value}`}
                        onPress={(): void => setStep(row.step)}
                        className="gap-2 border-b border-neutral-200 py-4 active:opacity-75"
                      >
                        <Text className="text-sm text-neutral-500">
                          {row.label}
                        </Text>
                        <Text className="text-base font-medium text-neutral-900">
                          {row.value}
                        </Text>
                      </Pressable>
                    ),
                  )}
                </View>
              )}
              {error && (
                <Text
                  accessibilityRole="alert"
                  className="mt-4 text-sm text-amber-700"
                >
                  {error}
                </Text>
              )}
              <View className="h-8" />
            </View>
          </View>
        </ScrollView>
        <View className={`gap-2 px-5 py-4 ${constrainContent ? "mx-auto w-full max-w-6xl" : ""}`}>
          <Button disabled={!club || submitting || (step === 0 && options.loadingDates) || (step === 1 && options.loadingTables)} loading={submitting} onPress={step === 3 ? confirm : next}>
            {step === 3 ? "Confirm Booking" : "Next"}
          </Button>
          {step > 0 && (
            <Button
              variant="text"
              disabled={submitting}
              onPress={(): void => {
                setError(null);
                setStep((step - 1) as Step);
              }}
            >
              Back
            </Button>
          )}
        </View>
      </KeyboardAvoidingView>
      <Modal
        visible={discard}
        transparent
        animationType="fade"
        onRequestClose={(): void => setDiscard(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/40 px-5">
          <View
            accessibilityViewIsModal
            className="w-full max-w-lg gap-4 rounded-2xl bg-white p-6"
          >
            <Text className="text-lg font-semibold text-neutral-900">
              Discard booking?
            </Text>
            <Text className="text-sm text-neutral-500">
              Your unfinished booking will be lost.
            </Text>
            <Button
              variant="outlined"
              onPress={(): void => {
                pendingLeave.current = null;
                setDiscard(false);
              }}
            >
              Keep editing
            </Button>
            <Button onPress={leave}>Discard booking</Button>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const CreateBookingScreen = (): ReactElement => {
  const { user } = useAuth();
  return user ? <BookingForm /> : <Redirect href="/account/sign-in" />;
};

export default CreateBookingScreen;
