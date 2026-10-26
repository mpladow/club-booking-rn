// File: src/components/navigation-tabs.tsx
import { router, usePathname } from "expo-router";
import { type ReactElement } from "react";
import { Pressable, Text, View } from "react-native";

import { APP_TABS, type AppTab } from "@/constants/navigation";

interface NavigationTabProps {
  label: string;
  selected: boolean;
  wide?: boolean;
  inline?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
}

export const NavigationTab = ({
  label,
  selected,
  wide = false,
  inline = false,
  onPress,
  onLongPress,
}: NavigationTabProps): ReactElement => {
  const sizeClasses: string = inline
    ? "h-10 rounded-lg px-3"
    : `h-12 rounded-xl ${wide ? "min-w-28 px-6" : "flex-1"}`;
  const stateClasses: string = inline
    ? `${selected ? "bg-neutral-100" : "bg-transparent hover:bg-neutral-100"} focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600`
    : selected ? "bg-indigo-50" : "bg-white";
  const labelClasses: string = selected
    ? inline ? "text-neutral-900" : "text-indigo-600"
    : "text-neutral-500";

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      aria-selected={selected}
      onPress={onPress}
      onLongPress={onLongPress}
      className={`items-center justify-center active:opacity-75 ${sizeClasses} ${stateClasses}`}
    >
      <Text className={`text-base font-semibold ${labelClasses}`}>
        {label}
      </Text>
    </Pressable>
  );
};

export const HeaderNavigation = ({
  inline = false,
}: {
  inline?: boolean;
}): ReactElement => {
  const pathname = usePathname();
  const selectedTab: AppTab["name"] =
    pathname === "/settings" ? "settings" : "index";

  return (
    <View
      testID="header-navigation"
      accessibilityRole="tablist"
      className={inline
        ? "flex-row items-center gap-1"
        : "flex-row gap-2 rounded-2xl border border-neutral-200 bg-white p-2 shadow-lg"}
    >
      {APP_TABS.map((tab: AppTab): ReactElement => (
        <NavigationTab
          key={tab.name}
          label={tab.label}
          selected={selectedTab === tab.name}
          wide
          inline={inline}
          onPress={(): void => {
            if (pathname === "/create-booking") router.dismissTo(tab.href);
            else router.navigate(tab.href);
          }}
        />
      ))}
    </View>
  );
};
