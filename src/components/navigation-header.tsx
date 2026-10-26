// File: src/components/navigation-header.tsx
import { type NativeStackHeaderProps } from "expo-router";
import { type BottomTabHeaderProps } from "expo-router/js-tabs";
import { useState, type ReactElement } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { Button } from "@/components/ui/Button";
import { useHeaderOpacity } from "@/hooks/use-header-scroll";

const OPACITY_CLASSES: readonly string[] = [
  "opacity-0",
  "opacity-5",
  "opacity-10",
  "opacity-15",
  "opacity-20",
  "opacity-25",
  "opacity-30",
  "opacity-35",
  "opacity-40",
  "opacity-45",
  "opacity-50",
  "opacity-55",
  "opacity-60",
  "opacity-65",
  "opacity-70",
  "opacity-75",
  "opacity-80",
  "opacity-85",
  "opacity-90",
  "opacity-95",
  "opacity-100",
];
const SUBTITLES: Readonly<Record<string, string>> = {
  "Your bookings": "A place at the table, all day.",
  Settings: "More settings will be available here soon.",
  "Select date": "Your table is reserved for the whole day.",
  "Select table": "Pick a place for your next game.",
  "Additional information": "Let others know what you have planned.",
  "Confirm booking": "Review your details. Tap any row to make changes.",
};
interface NavigationHeaderProps {
  routeKey: string;
  title: string;
  subtitle?: string;
}
export const NavigationHeader = ({
  routeKey,
  title,
  subtitle,
}: NavigationHeaderProps): ReactElement => {
  const opacity = useHeaderOpacity(routeKey);
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  return (
    <View>
      <View
        pointerEvents="none"
        testID="navigation-header-background"
        className={`absolute inset-0 bg-neutral-50 transition-opacity duration-100 motion-reduce:transition-none ${OPACITY_CLASSES[opacity]}`}
      />
      <SafeAreaView edges={["top", "left", "right"]}>
        <View className="h-28 flex-row items-center gap-3 px-5 py-4">
          <View className="flex-1 gap-1">
            <Text
              accessibilityRole="header"
              numberOfLines={2}
              className="text-2xl font-bold tracking-tight text-neutral-900"
            >
              {title}
            </Text>
            {subtitle && (
              <Text numberOfLines={2} className="text-sm text-neutral-500">
                {subtitle}
              </Text>
            )}
          </View>
          <Button
            variant="text"
            accessibilityLabel={`Open ${title} menu`}
            accessibilityState={{ expanded: menuOpen }}
            onPress={(): void => setMenuOpen(true)}
          >
            ⋯
          </Button>
        </View>
      </SafeAreaView>
      <Modal
        visible={menuOpen}
        transparent
        animationType="slide"
        onRequestClose={(): void => setMenuOpen(false)}
      >
        <View className="flex-1 justify-end bg-black/40">
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss menu"
            onPress={(): void => setMenuOpen(false)}
            className="absolute inset-0"
          />
          <SafeAreaView
            edges={["bottom", "left", "right"]}
            accessibilityViewIsModal
            className="rounded-t-2xl bg-white"
          >
            <View className="gap-5 px-5 pb-6 pt-4">
              <View
                accessible={false}
                className="h-1 w-10 self-center rounded-full bg-neutral-200"
              />
              <Text
                accessibilityRole="header"
                className="text-lg font-semibold text-neutral-900"
              >
                {title} menu
              </Text>
              <Text className="text-sm text-neutral-500">
                Menu actions will appear here.
              </Text>
              <View
                accessible={false}
                importantForAccessibility="no-hide-descendants"
                className="gap-3"
              >
                <View className="h-12 rounded-xl bg-neutral-100" />
                <View className="h-12 rounded-xl bg-neutral-100" />
              </View>
              <Button
                variant="outlined"
                onPress={(): void => setMenuOpen(false)}
              >
                Close menu
              </Button>
            </View>
          </SafeAreaView>
        </View>
      </Modal>
    </View>
  );
};
// Matches the header's content height and device insets inside each scroll view.
export const HeaderScrollInset = (): ReactElement => (
  <SafeAreaView edges={["top"]} pointerEvents="none">
    <View className="h-28" />
  </SafeAreaView>
);
export const renderNavigationHeader = ({
  route,
  options,
}: NativeStackHeaderProps | BottomTabHeaderProps): ReactElement => {
  const title: string = options.title ?? route.name;
  return (
    <NavigationHeader
      routeKey={route.key}
      title={title}
      subtitle={SUBTITLES[title]}
    />
  );
};
