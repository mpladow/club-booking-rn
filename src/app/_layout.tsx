import "@/global.css";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { type ReactElement } from "react";
import { HeaderScrollProvider } from "@/hooks/use-header-scroll";
import { renderNavigationHeader } from "@/components/navigation-header";
import { BookingsProvider } from "@/hooks/use-bookings";

const RootLayout = (): ReactElement => {
  return (
    <BookingsProvider>
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

export default RootLayout;
