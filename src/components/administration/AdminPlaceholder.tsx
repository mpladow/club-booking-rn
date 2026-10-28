// File: src/components/administration/AdminPlaceholder.tsx
import { type ReactElement } from "react";
import { Text, View } from "react-native";
import { type AdminSection } from "@/data/administration";
import { useAdministrationFocus } from "@/hooks/use-administration";
import { AdminPage } from "./AdminPage";
export const AdminPlaceholder = ({ title, section }: { title: string; section: AdminSection }): ReactElement => {
  const allowed: boolean = useAdministrationFocus(section);
  return <AdminPage title={title} allowed={allowed} back="/admin">
    <View className="rounded-xl border border-neutral-200 bg-white p-6"><Text className="text-base text-neutral-500">{title} management coming soon.</Text></View>
  </AdminPage>;
};
