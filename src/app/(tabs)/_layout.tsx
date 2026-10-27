// File: src/app/(tabs)/_layout.tsx
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { type ReactElement } from "react";
import { View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { renderNavigationHeader } from "@/components/navigation-header";
import { NavigationTab } from "@/components/navigation-tabs";
import { useWideNavigation } from "@/hooks/use-wide-navigation";
import { useAuth } from "@/hooks/use-auth";

const FloatingTabBar = ({
  state,
  descriptors,
  emitter,
  navigateToTab,
}: BottomTabBarProps): ReactElement => (
  <SafeAreaView
    testID="bottom-navigation"
    edges={["bottom", "left", "right"]}
    className="absolute bottom-4 left-5 right-5 rounded-2xl border border-neutral-200 bg-white shadow-lg"
  >
    <View className="flex-row gap-2 p-2">
      {state.routes.map((route: BottomTabBarProps["state"]["routes"][number], index: number): ReactElement | null => {
        if (route.name === "account") return null;
        const focused: boolean = state.index === index;
        const label: string =
          route.name === "index"
            ? "Bookings"
            : (descriptors[route.key].options.title ?? route.name);
        return (
          <NavigationTab
            key={route.key}
            label={label}
            selected={focused}
            onPress={(): void => {
              const event = emitter.emit({
                type: "tabPress",
                target: route.key,
                canPreventDefault: true,
              });
              if (!focused && !event.defaultPrevented) navigateToTab(route.key);
            }}
            onLongPress={(): void => {
              emitter.emit({ type: "tabLongPress", target: route.key });
            }}
          />
        );
      })}
    </View>
  </SafeAreaView>
);
const TabsLayout = (): ReactElement => {
  const wide = useWideNavigation();
  const { user } = useAuth();
  return (
    <Tabs
      tabBar={(props: BottomTabBarProps): ReactElement | null =>
        wide ? null : <FloatingTabBar {...props} />
      }
      screenOptions={{
        header: renderNavigationHeader,
        headerTransparent: true,
        headerShown: true,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Your bookings" }} />
      <Tabs.Screen name="settings" options={{ title: "Settings" }} />
      <Tabs.Protected guard={!user}>
        {/* The custom tab bar omits Account; href: null would also redirect its routes. */}
        <Tabs.Screen name="account" options={{ headerShown: false }} />
      </Tabs.Protected>
    </Tabs>
  );
};
export default TabsLayout;
