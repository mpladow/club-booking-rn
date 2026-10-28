// File: src/app/(tabs)/settings.tsx
import { type ReactElement } from "react";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { HeaderScrollInset } from "@/components/navigation-header";
import { ScreenHeading } from "@/components/screen-heading";
import { useScreenScroll } from "@/hooks/use-header-scroll";
import { useWideNavigation } from "@/hooks/use-wide-navigation";
const SettingsScreen = (): ReactElement => {
  const onScroll = useScreenScroll();
  const wide = useWideNavigation();
  const constrainContent: boolean = Platform.OS === "web" && wide;
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
        <View className={constrainContent ? "w-screen" : undefined}>
          <View className={`px-5 ${constrainContent ? "mx-auto w-full max-w-6xl" : ""}`}>
            <ScreenHeading title="Settings" />
          </View>
        </View>
        <View className={wide ? "h-8" : "h-32"} />
      </ScrollView>
    </SafeAreaView>
  );
};

export default SettingsScreen;
