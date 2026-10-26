// File: src/app/(tabs)/_layout.tsx
import { Tabs, type BottomTabBarProps } from "expo-router/js-tabs";
import { type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { renderNavigationHeader } from "@/components/navigation-header";

const FloatingTabBar = ({
  state,
  descriptors,
  emitter,
  navigateToTab,
}: BottomTabBarProps): ReactElement => (
  <SafeAreaView
    edges={["bottom", "left", "right"]}
    className="absolute bottom-4 left-5 right-5 rounded-2xl border border-neutral-200 bg-white shadow-lg"
  >
    <View className="flex-row gap-2 p-2">
      {state.routes.map((route: BottomTabBarProps["state"]["routes"][number], index: number): ReactElement => {
        const focused: boolean = state.index === index;
        const label: string =
          route.name === "index"
            ? "Bookings"
            : (descriptors[route.key].options.title ?? route.name);
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
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
            className={`h-12 flex-1 items-center justify-center rounded-xl active:opacity-75 ${focused ? "bg-indigo-50" : "bg-white"}`}
          >
            <Text
              className={`text-base font-semibold ${focused ? "text-indigo-600" : "text-neutral-500"}`}
            >
              {label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  </SafeAreaView>
);
const TabsLayout = (): ReactElement => (
  <Tabs
    tabBar={(props: BottomTabBarProps): ReactElement => (
      <FloatingTabBar {...props} />
    )}
    screenOptions={{
      header: renderNavigationHeader,
      headerTransparent: true,
      headerShown: true,
      headerShadowVisible: false,
    }}
  >
    <Tabs.Screen name="index" options={{ title: "Your bookings" }} />
    <Tabs.Screen name="settings" options={{ title: "Settings" }} />
  </Tabs>
);
export default TabsLayout;
