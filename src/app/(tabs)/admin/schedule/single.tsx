// File: src/app/(tabs)/admin/schedule/single.tsx
import { useLocalSearchParams } from "expo-router";
import { type ReactElement } from "react";
import { ScheduleForm } from "@/components/administration/ScheduleForm";
const SingleTimeslotScreen = (): ReactElement => {
  const { id, date } = useLocalSearchParams<{ id?: string; date?: string }>();
  return <ScheduleForm key={`${id ?? "new"}:${date ?? ""}`} kind="single" id={id} date={date} />;
};
export default SingleTimeslotScreen;
