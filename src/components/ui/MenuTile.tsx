// File: src/components/ui/MenuTile.tsx
import Ionicons from "@expo/vector-icons/Ionicons";
import { type ComponentProps, type ReactElement } from "react";
import { Pressable, Text, View, type PressableProps } from "react-native";

export type MenuTileIcon = ComponentProps<typeof Ionicons>["name"];

export interface MenuTileProps extends Omit<PressableProps, "children" | "style" | "className" | "accessibilityRole" | "onPress"> {
  title: string;
  subtitle?: string;
  icon: MenuTileIcon;
  onPress: NonNullable<PressableProps["onPress"]>;
}

// Shared menu presentation. Callers own navigation and permission checks; all tiles
// retain consistent spacing, typography, icon treatment and interaction states.
export const MenuTile = ({
  title,
  subtitle,
  icon,
  disabled = false,
  accessibilityLabel,
  accessibilityState,
  onPress,
  ...props
}: MenuTileProps): ReactElement => (
  <Pressable
    {...props}
    accessibilityRole="button"
    accessibilityLabel={accessibilityLabel ?? (subtitle ? `${title}. ${subtitle}` : title)}
    accessibilityState={{ ...accessibilityState, disabled }}
    disabled={disabled}
    onPress={onPress}
    className={`min-h-24 flex-row items-center gap-4 rounded-xl border border-neutral-200 bg-white p-5 ${disabled
      ? "opacity-50"
      : "active:opacity-75 hover:border-indigo-300 focus-visible:outline-2 focus-visible:outline-indigo-600"}`}
  >
    <View accessible={false} aria-hidden accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      className="h-12 w-12 items-center justify-center rounded-xl bg-indigo-50">
      <Ionicons name={icon} size={24} color="#4F46E5" />
    </View>
    <View className="min-w-0 flex-1 gap-1">
      <Text className="text-lg font-semibold text-neutral-900">{title}</Text>
      {subtitle && <Text className="text-sm text-neutral-500">{subtitle}</Text>}
    </View>
    <Ionicons accessible={false} aria-hidden name="arrow-forward-outline" size={20} color="#737373" />
  </Pressable>
);
