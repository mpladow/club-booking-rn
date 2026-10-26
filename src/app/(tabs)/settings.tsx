// File: src/app/(tabs)/settings.tsx
import { type ReactElement } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { useBookings } from "@/hooks/use-bookings";
import { HeaderScrollInset } from "@/components/navigation-header";
import { useScreenScroll } from "@/hooks/use-header-scroll";
const SettingsScreen = (): ReactElement => {
  const onScroll = useScreenScroll();
  const { failNext, setFailNext } = useBookings();
  return (
    <SafeAreaView
      edges={["left", "right"]}
      className="min-h-0 flex-1 bg-neutral-50"
    >
      <ScrollView
        className="min-h-0 flex-1"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        automaticallyAdjustContentInsets={false}
      >
        <HeaderScrollInset />
        <View className="gap-6 px-5">
          {__DEV__ && (
            <View className="gap-4 rounded-xl border border-neutral-200 bg-white p-4">
              <Text className="text-lg font-semibold text-neutral-900">
                Development
              </Text>
              <View className="flex-row items-center justify-between gap-4">
                <Text className="flex-1 text-base font-medium text-neutral-900">
                  Fail next booking
                </Text>
                <Switch
                  accessibilityLabel="Fail next booking"
                  value={failNext}
                  onValueChange={setFailNext}
                />
              </View>
              <Text className="text-sm text-neutral-500">
                The next submission will fail after the simulated request. This
                resets after one submission.
              </Text>
            </View>
          )}
        </View>
        <View className="h-32" />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
