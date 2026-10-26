// File: src/components/navigation-header.tsx
import { type NativeStackHeaderProps } from "expo-router";
import { type BottomTabHeaderProps } from "expo-router/js-tabs";
import { useState, type ReactElement } from "react";
import { Modal, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { Button } from "@/components/ui/Button";
import { HeaderNavigation } from "@/components/navigation-tabs";
import { CLUB_NAME, PAGE_SUBTITLES } from "@/constants/navigation";
import { useHeaderOpacity } from "@/hooks/use-header-scroll";
import { useWideNavigation } from "@/hooks/use-wide-navigation";

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
  const wide = useWideNavigation();
  const compactWebHeader: boolean = Platform.OS === "web" && wide;
  const [menuOpen, setMenuOpen] = useState<boolean>(false);
  return (
    <View testID="navigation-header">
      <View
        pointerEvents="none"
        testID="navigation-header-background"
        className={compactWebHeader
          ? "absolute inset-0 border-b border-neutral-200 bg-white"
          : `absolute inset-0 bg-neutral-50 transition-opacity duration-100 motion-reduce:transition-none ${OPACITY_CLASSES[opacity]}`}
      />
      <SafeAreaView edges={["top", "left", "right"]}>
        <View className={compactWebHeader
          ? "mx-auto h-16 w-full max-w-6xl flex-row items-center gap-3 px-5"
          : "h-28 flex-row items-center gap-3 px-5 py-4"}>
          {wide ? (
            <>
              <View className={compactWebHeader
                ? "min-w-0 flex-1 flex-row items-center gap-3"
                : "min-w-0 flex-1"}>
                {compactWebHeader && (
                  <View
                    testID="wide-club-initial"
                    accessible={false}
                    aria-hidden
                    className="h-8 w-8 items-center justify-center rounded-full border border-neutral-200 bg-neutral-50"
                  >
                    <Text className="text-base font-semibold text-neutral-900">
                      {CLUB_NAME.trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text
                  numberOfLines={1}
                  className={compactWebHeader
                    ? "min-w-0 shrink text-base font-bold text-neutral-900"
                    : "text-lg font-semibold text-neutral-900"}
                >
                  {CLUB_NAME}
                </Text>
              </View>
              <HeaderNavigation inline={compactWebHeader} />
            </>
          ) : (
            <>
              <View
                testID="club-initial"
                accessible={false}
                aria-hidden
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
                className="h-10 w-10 items-center justify-center rounded-xl bg-indigo-50"
              >
                <Text className="text-lg font-semibold text-indigo-600">
                  {CLUB_NAME.trim().charAt(0).toUpperCase()}
                </Text>
              </View>
              <View className="min-w-0 flex-1 gap-1">
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
            </>
          )}
          <View className={wide ? "min-w-0 flex-1 items-end" : "items-end"}>
            {compactWebHeader ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Open ${title} menu`}
                accessibilityState={{ expanded: menuOpen }}
                aria-expanded={menuOpen}
                onPress={(): void => setMenuOpen(true)}
                className="h-10 w-10 items-center justify-center rounded-lg hover:bg-neutral-100 active:opacity-75 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
              >
                <Text className="text-2xl font-bold text-neutral-900">⋯</Text>
              </Pressable>
            ) : (
              <Button
                variant="text"
                accessibilityLabel={`Open ${title} menu`}
                accessibilityState={{ expanded: menuOpen }}
                onPress={(): void => setMenuOpen(true)}
              >
                ⋯
              </Button>
            )}
          </View>
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
export const HeaderScrollInset = (): ReactElement => {
  const wide = useWideNavigation();
  const compactWebHeader: boolean = Platform.OS === "web" && wide;
  return (
    <SafeAreaView edges={["top"]} pointerEvents="none">
      <View className={compactWebHeader ? "h-16" : "h-28"} />
    </SafeAreaView>
  );
};
export const renderNavigationHeader = ({
  route,
  options,
}: NativeStackHeaderProps | BottomTabHeaderProps): ReactElement => {
  const title: string = options.title ?? route.name;
  return (
    <NavigationHeader
      routeKey={route.key}
      title={title}
      subtitle={PAGE_SUBTITLES[title]}
    />
  );
};
