// File: src/app/(tabs)/admin/schedule/recurring.tsx
import { useLocalSearchParams } from "expo-router";
import { type ReactElement } from "react";
import { ScheduleForm } from "@/components/administration/ScheduleForm";
const RecurringTimeslotScreen = (): ReactElement => {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <ScheduleForm key={id ?? "new"} kind="recurring" id={id} />;
};
export default RecurringTimeslotScreen;
