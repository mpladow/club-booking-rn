import "@/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactElement } from "react";
import { ActivityIndicator, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { Button } from "@/components/ui/Button";
import { HeaderScrollProvider } from "@/hooks/use-header-scroll";
import { renderNavigationHeader } from "@/components/navigation-header";
import { BookingsProvider } from "@/hooks/use-bookings";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { AuthDialogProvider } from "@/hooks/use-auth-dialog";

const AuthenticatedLayout = (): ReactElement => {
  const { user, loading, restoreError, restore } = useAuth();
  if (loading || restoreError) {
    return (
      <SafeAreaView className="flex-1 justify-center bg-neutral-50 px-5">
        <View className="mx-auto w-full max-w-lg gap-5">
          {loading ? <ActivityIndicator accessibilityLabel="Restoring sign-in" /> : (
            <>
              <Text accessibilityRole="alert" className="text-base font-medium text-neutral-900">Your sign-in could not be restored. Please try again.</Text>
              <Button onPress={restore}>Try again</Button>
            </>
          )}
        </View>
      </SafeAreaView>
    );
  }
  return (
    <BookingsProvider key={`${user?.id ?? "guest"}:${user?.clubId ?? "none"}`} clubId={user?.clubId ?? null}>
      <HeaderScrollProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            header: renderNavigationHeader,
            headerTransparent: true,
            headerShown: true,
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="create-booking"
            options={{ gestureEnabled: false, title: "Select date" }}
          />
        </Stack>
      </HeaderScrollProvider>
    </BookingsProvider>
  );
};

const RootLayout = (): ReactElement => (
  <AuthProvider>
    <AuthDialogProvider>
      <AuthenticatedLayout />
    </AuthDialogProvider>
  </AuthProvider>
);

export default RootLayout;
