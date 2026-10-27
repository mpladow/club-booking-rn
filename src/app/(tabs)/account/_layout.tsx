// File: src/app/(tabs)/account/_layout.tsx
import { Stack } from "expo-router";
import { type ReactElement } from "react";

const AccountLayout = (): ReactElement => (
  <Stack screenOptions={{ headerShown: false }}>
    <Stack.Screen name="sign-in" options={{ title: "Sign In" }} />
    <Stack.Screen name="sign-up" options={{ title: "Register" }} />
    <Stack.Screen name="forgot-password" options={{ title: "Reset password" }} />
    <Stack.Screen name="check-email" options={{ title: "Check your email" }} />
  </Stack>
);
export default AccountLayout;
