// File: src/app/(tabs)/account/_layout.tsx
import { Stack } from "expo-router";
import { type ReactElement } from "react";
import { renderNavigationHeader } from "@/components/navigation-header";

const AccountLayout = (): ReactElement => (
  <Stack screenOptions={{ header: renderNavigationHeader, headerTransparent: true, headerShown: true, headerShadowVisible: false }}>
    <Stack.Screen name="sign-in" options={{ title: "Sign In" }} />
    <Stack.Screen name="sign-up" options={{ title: "Sign Up" }} />
    <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
    <Stack.Screen name="check-email" options={{ title: "Check your email" }} />
  </Stack>
);
export default AccountLayout;
