// File: src/app/create-booking.tsx
import { Redirect, router, Stack, usePreventRemove } from "expo-router";
import { useRef, useState, type ReactElement } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { BookingCalendar } from "@/components/booking-calendar";
import { Button } from "@/components/ui/Button";
import {
  dateLabel,
  TABLES,
  today,
  validDraft,
  type BookingDraft,
} from "@/data/bookings";
import { useBookings } from "@/hooks/use-bookings";
import { HeaderScrollInset } from "@/components/navigation-header";
import { ScreenHeading } from "@/components/screen-heading";
import { useScreenScroll } from "@/hooks/use-header-scroll";
import { useWideNavigation } from "@/hooks/use-wide-navigation";
import { useAuth } from "@/hooks/use-auth";
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
  const { submit } = useBookings();
  const [step, setStep] = useState<Step>(0);
  const [draft, setDraft] = useState<BookingDraft>({
    date: "",
    table: 0,
    game: "",
    spectators: false,
    demo: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [discard, setDiscard] = useState<boolean>(false);
  const [finished, setFinished] = useState<boolean>(false);
  const submitted = useRef<boolean>(false);
  const pendingLeave = useRef<(() => void) | null>(null);
  const disablePrevention = usePreventRemove(!finished, ({ repeat }): void => {
    pendingLeave.current = repeat;
    setDiscard(true);
  });
  const update = (patch: Partial<BookingDraft>): void => {
    setDraft(
      (current: BookingDraft): BookingDraft => ({ ...current, ...patch }),
    );
    setError(null);
  };
  const next = (): boolean => {
    if (step === 0 && (!draft.date || draft.date < today())) {
      setError("Choose today or a future date.");
      return false;
    }
    if (step === 1 && !TABLES.includes(draft.table)) {
      setError("Choose one table.");
      return false;
    }
    if (step === 2 && draft.game.length > 50) {
      setError("Use 50 characters or fewer.");
      return false;
    }
    setError(null);
    setStep((step + 1) as Step);
    return true;
  };
  const confirm = (): boolean => {
    if (submitted.current) return false;
    if (!validDraft(draft)) {
      setError("Check your date, table and game before confirming.");
      return false;
    }
    submitted.current = true;
    submit(draft);
    setFinished(true);
    disablePrevention();
    router.replace("/");
    // Submission haptics run only when the asynchronous save succeeds.
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
    { label: "Date", value: `${dateLabel(draft.date)} · All day`, step: 0 },
    { label: "Table", value: `Table ${draft.table}`, step: 1 },
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
                <Button variant="text" onPress={(): void => setDiscard(true)}>
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
              {step === 0 && (
                <BookingCalendar
                  value={draft.date}
                  onChange={(date: string): void => update({ date })}
                />
              )}
              {step === 1 && (
                <View className="gap-4">
                  {TABLES.map(
                    (table: number): ReactElement => (
                      <Button
                        key={table}
                        variant={
                          draft.table === table
                            ? "toggle-active"
                            : "toggle-inactive"
                        }
                        onPress={(): void => update({ table })}
                      >{`Table ${table}`}</Button>
                    ),
                  )}
                </View>
              )}
              {step === 2 && (
                <View className="gap-6">
                  <View className="gap-2">
                    <Text
                      nativeID="game-label"
                      className="text-base font-medium text-neutral-900"
                    >
                      What game are you playing?
                    </Text>
                    <TextInput
                      accessibilityLabel="What game are you playing? Optional"
                      placeholder="Game name (optional)"
                      value={draft.game}
                      onChangeText={(game: string): void => update({ game })}
                      maxLength={50}
                      className="h-12 rounded-xl border border-neutral-200 bg-white px-4 text-base text-neutral-900 focus:border-indigo-600"
                    />
                    <Text className="text-sm text-neutral-500">
                      Optional · {draft.game.length}/50
                    </Text>
                  </View>
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
          <Button onPress={step === 3 ? confirm : next}>
            {step === 3 ? "Confirm Booking" : "Next"}
          </Button>
          {step > 0 && (
            <Button
              variant="text"
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
