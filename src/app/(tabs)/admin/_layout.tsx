// File: src/app/(tabs)/admin/_layout.tsx
import { Stack } from "expo-router";
import { type ReactElement } from "react";
import { renderNavigationHeader } from "@/components/navigation-header";

export const unstable_settings = { initialRouteName: "index" };
const AdministrationLayout = (): ReactElement => (
  <Stack screenOptions={{ header: renderNavigationHeader, headerTransparent: true, headerShadowVisible: false }}>
    <Stack.Screen name="index" options={{ title: "Administration" }} />
    <Stack.Screen name="club-details" options={{ title: "Club Details" }} />
    <Stack.Screen name="schedule/index" options={{ title: "Schedule" }} />
    <Stack.Screen name="schedule/single" options={{ title: "Single Timeslot" }} />
    <Stack.Screen name="schedule/recurring" options={{ title: "Recurring Timeslot" }} />
    <Stack.Screen name="users" options={{ title: "Users" }} />
    <Stack.Screen name="tables/index" options={{ title: "Tables" }} />
    <Stack.Screen name="tables/create" options={{ title: "Create Table" }} />
    <Stack.Screen name="tables/[tableId]" options={{ title: "Edit Table" }} />
  </Stack>
);
export default AdministrationLayout;
