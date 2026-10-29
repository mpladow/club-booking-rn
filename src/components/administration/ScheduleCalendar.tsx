// File: src/components/administration/ScheduleCalendar.tsx
import { type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { WEEKDAYS, monthRange, moveMonth, type TimeslotDetails } from "@/data/scheduling";
import { Button } from "@/components/ui/Button";
export const ScheduleCalendar = ({ month, today, timeslots, changeMonth, selectDate, canCreate, busy }: {
  month: string; today: string; timeslots: readonly TimeslotDetails[]; changeMonth: (month: string) => void;
  selectDate: (date: string) => void; canCreate: boolean; busy: boolean;
}): ReactElement => {
  const { from, to } = monthRange(month);
  const offset: number = new Date(`${from}T12:00:00Z`).getUTCDay();
  const count: number = Number(to.slice(-2));
  const counts: Record<string, number> = {};
  for (const slot of timeslots) counts[slot.localSessionDate] = (counts[slot.localSessionDate] ?? 0) + 1;
  return <View className="gap-3">
    <View className="flex-row flex-wrap items-center justify-between gap-2"><Text accessibilityLiveRegion="polite" className="text-lg font-semibold text-neutral-900">{new Date(`${from}T12:00:00Z`).toLocaleDateString("en-AU", { month: "long", year: "numeric", timeZone: "UTC" })}</Text>
      <View className="flex-row"><Button variant="text" accessibilityLabel="Previous month" onPress={(): void => changeMonth(moveMonth(month, -1))}>‹</Button><Button variant="text" onPress={(): void => changeMonth(today.slice(0, 7))}>Today</Button><Button variant="text" accessibilityLabel="Next month" onPress={(): void => changeMonth(moveMonth(month, 1))}>›</Button></View></View>
    <View className="flex-row">{WEEKDAYS.map((day: string): ReactElement => <Text key={day} className="flex-1 text-center text-sm text-neutral-500">{day.slice(0, 2)}</Text>)}</View>
    {Array.from({ length: Math.ceil((offset + count) / 7) }, (_: unknown, row: number): ReactElement => <View key={row} className="flex-row gap-1">
      {Array.from({ length: 7 }, (_: unknown, col: number): ReactElement => {
        const day: number = row * 7 + col - offset + 1;
        const date: string = `${month}-${String(day).padStart(2, "0")}`;
        const exists: boolean = day > 0 && day <= count;
        const total: number = counts[date] ?? 0;
        const disabled: boolean = busy || !exists || (!total && (!canCreate || date < today));
        return <Pressable key={col} disabled={disabled} accessibilityRole="button" accessibilityLabel={exists ? `${date}, ${total} timeslots${!total && !disabled ? ", create single timeslot" : ""}` : "Empty day"}
          accessibilityState={{ disabled, selected: exists && date === today }} onPress={(): void => selectDate(date)}
          className={`min-h-16 flex-1 items-center justify-center rounded-xl border active:opacity-75 ${total ? "border-indigo-200 bg-indigo-50" : date === today && exists ? "border-indigo-600" : "border-transparent"}`}>
          <Text className={`text-base font-medium ${disabled ? "text-neutral-300" : "text-neutral-900"}`}>{exists ? day : ""}</Text>
          <Text className="text-xs text-indigo-700">{exists && total ? `${total} slot${total > 1 ? "s" : ""}` : " "}</Text>
        </Pressable>;
      })}</View>)}
    <Text className="text-sm text-neutral-500">Highlighted days contain existing sessions. Future sessions appear as the API generates them.</Text>
  </View>;
};
