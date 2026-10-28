// File: src/app/(tabs)/admin/index.tsx
import { router } from "expo-router";
import { type ReactElement } from "react";
import { Text, View } from "react-native";
import { AdminPage } from "@/components/administration/AdminPage";
import { MenuTile } from "@/components/ui/MenuTile";
import { ADMIN_MENU, type AdminMenuItem } from "@/constants/administration";
import { useAdministration, useAdministrationFocus } from "@/hooks/use-administration";
import { useWideNavigation } from "@/hooks/use-wide-navigation";

const AdministrationScreen = (): ReactElement => {
  const allowed: boolean = useAdministrationFocus();
  const { access } = useAdministration();
  const wide: boolean = useWideNavigation();
  return <AdminPage title="Administration" allowed={allowed}>
    <View className={wide ? "flex-row items-start gap-8" : "gap-6"}>
      <View testID="administration-metrics" className={`min-h-40 items-center justify-center rounded-xl border border-neutral-200 p-6 ${wide ? "w-72" : "w-full"}`}>
        <Text className="text-sm text-neutral-500">Metrics coming soon</Text>
      </View>
      <View className="min-w-0 flex-1 gap-3">
        {ADMIN_MENU.filter((item: AdminMenuItem): boolean => Boolean(access?.permissions[item.section].view)).map((item: AdminMenuItem): ReactElement => (
          <MenuTile key={item.section} title={item.title} subtitle={item.subtitle} icon={item.icon}
            onPress={(): void => router.push(item.href)} />
        ))}
      </View>
    </View>
  </AdminPage>;
};
export default AdministrationScreen;
