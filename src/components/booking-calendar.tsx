// File: src/components/booking-calendar.tsx
import { useState, type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { today } from "@/data/bookings";
import { Button } from "@/components/ui/Button";
const keyFor = (year: number, month: number, day: number): string =>
  `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
export const BookingCalendar = ({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}): ReactElement => {
  const [month, setMonth] = useState<Date>(
    () => new Date(`${value || today()}T12:00:00`),
  );
  const year = month.getFullYear();
  const index = month.getMonth();
  const start = new Date(year, index, 1).getDay();
  const count = new Date(year, index + 1, 0).getDate();
  const earliest = today();
  const previousDisabled =
    keyFor(year, index, 1).slice(0, 7) <= earliest.slice(0, 7);
  const cells: (number | null)[] = Array.from(
    { length: Math.ceil((start + count) / 7) * 7 },
    (_: unknown, i: number): number | null =>
      i >= start && i < start + count ? i - start + 1 : null,
  );
  return (
    <View className="gap-4 rounded-xl border border-neutral-200 bg-white p-4">
      <View className="flex-row items-center justify-between">
        <Button
          variant="text"
          accessibilityLabel="Previous month"
          disabled={previousDisabled}
          onPress={(): void => setMonth(new Date(year, index - 1, 1))}
        >
          ‹
        </Button>
        <Text
          accessibilityLiveRegion="polite"
          className="text-base font-medium text-neutral-900"
        >
          {month.toLocaleDateString("en-AU", {
            month: "long",
            year: "numeric",
          })}
        </Text>
        <Button
          variant="text"
          accessibilityLabel="Next month"
          onPress={(): void => setMonth(new Date(year, index + 1, 1))}
        >
          ›
        </Button>
      </View>
      <View className="flex-row">
        {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map(
          (day: string): ReactElement => (
            <View key={day} className="flex-1 items-center">
              <Text className="text-sm text-neutral-500">{day}</Text>
            </View>
          ),
        )}
      </View>
      {Array.from(
        { length: cells.length / 7 },
        (_: unknown, row: number): ReactElement => (
          <View key={row} className="flex-row">
            {cells
              .slice(row * 7, row * 7 + 7)
              .map((day: number | null, col: number): ReactElement => {
                const date = day ? keyFor(year, index, day) : "";
                const disabled = !day || date < earliest;
                return (
                  <Pressable
                    key={col}
                    disabled={disabled}
                    accessibilityRole="button"
                    accessibilityLabel={date || "Empty day"}
                    accessibilityState={{
                      disabled,
                      selected: date !== "" && value === date,
                    }}
                    onPress={(): void => onChange(date)}
                    className={`h-12 flex-1 items-center justify-center rounded-xl active:opacity-75 ${date !== "" && value === date ? "bg-indigo-600" : ""}`}
                  >
                    <Text
                      className={`text-base font-medium ${date !== "" && value === date ? "text-white" : disabled ? "text-neutral-300" : "text-neutral-900"}`}
                    >
                      {day ?? ""}
                    </Text>
                  </Pressable>
                );
              })}
          </View>
        ),
      )}
    </View>
  );
};
