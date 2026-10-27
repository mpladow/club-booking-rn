// File: src/components/auth/AuthScreen.tsx
import { type ReactElement, type ReactNode } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { HeaderScrollInset } from "@/components/navigation-header";
import { ScreenHeading } from "@/components/screen-heading";
import { useScreenScroll } from "@/hooks/use-header-scroll";

interface AuthScreenProps {
  title: string;
  children: ReactNode;
  busy?: boolean;
  error?: string | null;
}

export const AuthScreen = ({ title, children, busy = false, error }: AuthScreenProps): ReactElement => {
  const onScroll = useScreenScroll();
  return (
    <SafeAreaView edges={["left", "right"]} className="min-h-0 flex-1 bg-neutral-50">
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="min-h-0 flex-1">
        <ScrollView
          className="min-h-0 flex-1"
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentInsetAdjustmentBehavior="never"
          automaticallyAdjustContentInsets={false}
        >
          <HeaderScrollInset />
          <View className="mx-auto w-full max-w-lg gap-5 px-5 pt-4">
            <ScreenHeading title={title} />
            {error && <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}
            {busy && <ActivityIndicator accessibilityLabel="Please wait" />}
            {children}
            <Text className="text-sm text-neutral-500">Demo mode. Accounts are local to this device and emails are not sent.</Text>
          </View>
          <View className="h-36" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};
