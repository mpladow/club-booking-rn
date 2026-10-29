// File: src/components/administration/ScheduleControls.tsx
import { useState, type ReactElement, type ReactNode } from "react";
import { FlatList, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { Button } from "@/components/ui/Button";
import { BookingCalendar } from "@/components/booking-calendar";
export const ScheduleModal = ({ title, visible, close, children }: { title: string; visible: boolean; close: () => void; children: ReactNode }): ReactElement => (
  <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
    <SafeAreaView className="flex-1 justify-center bg-black/40 p-5">
      <View accessibilityViewIsModal className="mx-auto max-h-full w-full max-w-xl gap-3 rounded-2xl border border-neutral-200 bg-white p-5">
        <View className="flex-row items-center justify-between gap-3"><Text accessibilityRole="header" className="flex-1 text-lg font-semibold text-neutral-900">{title}</Text><Button variant="text" accessibilityLabel={`Close ${title}`} onPress={close}>Close</Button></View>
        {children}
      </View>
    </SafeAreaView>
  </Modal>
);
export const SelectField = ({ label, value, options, change, disabled, error }: {
  label: string; value: string; options: readonly string[]; change: (value: string) => void; disabled?: boolean; error?: string;
}): ReactElement => {
  const [open, setOpen] = useState<boolean>(false);
  return <View className="gap-2"><Text className="text-base font-medium text-neutral-900">{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value.includes(":") ? value.slice(0, 5) : value}`} accessibilityState={{ disabled, expanded: open }} disabled={disabled}
      onPress={(): void => setOpen(true)} className={`h-12 flex-row items-center justify-between rounded-xl border border-neutral-200 px-4 active:opacity-75 ${disabled ? "opacity-50" : ""}`}>
      <Text className="text-base text-neutral-900">{value.length === 8 && value.includes(":") ? value.slice(0, 5) : value}</Text><Ionicons name="chevron-down" size={18} color="#737373" />
    </Pressable>
    {error && <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}
    <ScheduleModal title={label} visible={open && !disabled} close={(): void => setOpen(false)}>
      <FlatList data={options} keyExtractor={(item: string): string => item} initialNumToRender={12} keyboardShouldPersistTaps="handled"
        renderItem={({ item }: { item: string }): ReactElement => <Pressable accessibilityRole="button" accessibilityState={{ selected: item === value }}
          onPress={(): void => { change(item); setOpen(false); }} className={`min-h-12 justify-center rounded-xl px-4 active:opacity-75 ${item === value ? "bg-indigo-50" : ""}`}>
          <Text className="text-base text-neutral-900">{item.includes(":") ? item.slice(0, 5) : item}</Text></Pressable>} />
    </ScheduleModal>
  </View>;
};
export const DateField = ({ label, value, minimum, change, disabled, optional, error }: {
  label: string; value: string; minimum: string; change: (value: string) => void; disabled?: boolean; optional?: boolean; error?: string;
}): ReactElement => {
  const [open, setOpen] = useState<boolean>(false);
  return <View className="gap-2"><Text className="text-base font-medium text-neutral-900">{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value || "No end date"}`} accessibilityState={{ disabled, expanded: open }} disabled={disabled}
      onPress={(): void => setOpen(true)} className={`h-12 flex-row items-center justify-between rounded-xl border border-neutral-200 px-4 active:opacity-75 ${disabled ? "opacity-50" : ""}`}>
      <Text className="text-base text-neutral-900">{value || "No end date"}</Text><Ionicons name="calendar-outline" size={20} color="#737373" /></Pressable>
    {optional && value && !disabled && <Button variant="text" onPress={(): void => change("")}>Remove end date</Button>}
    {error && <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}
    <ScheduleModal title={label} visible={open && !disabled} close={(): void => setOpen(false)}><ScrollView keyboardShouldPersistTaps="handled">
      <BookingCalendar key={`${open}:${minimum}`} value={value >= minimum ? value : minimum} earliestDate={minimum} onChange={(date: string): void => { change(date); setOpen(false); }} />
    </ScrollView></ScheduleModal>
  </View>;
};
