// File: src/components/auth/CheckEmailScreen.tsx
import { Redirect, router } from "expo-router";
import { useState, type ReactElement } from "react";
import { Text, View } from "react-native";
import { AuthScreen } from "./AuthScreen";
import { Button } from "@/components/ui/Button";
import { authErrorMessage } from "@/data/auth";
import { useAuth } from "@/hooks/use-auth";

export const CheckEmailScreen = (): ReactElement => {
  const { flowEmail, emailPurpose, resendConfirmation } = useAuth();
  const [busy, setBusy] = useState<boolean>(false);
  const [resent, setResent] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const resend = async (): Promise<boolean> => {
    if (busy || !flowEmail) return false;
    setBusy(true);
    setError(null);
    try {
      await resendConfirmation();
      setResent(true);
      return false;
    } catch (failure: unknown) {
      setError(authErrorMessage(failure));
      return false;
    } finally {
      setBusy(false);
    }
  };
  if (!flowEmail) return <Redirect href="/account/sign-in" />;
  return (
    <AuthScreen title="Check your email" busy={busy} error={error}>
      <View className="gap-3 rounded-xl border border-neutral-200 bg-white p-4">
        <Text className="text-lg font-semibold text-neutral-900">{emailPurpose === "reset" ? "Password reset requested" : "Your account is ready"}</Text>
        <Text className="text-base font-medium text-neutral-900">
          {emailPurpose === "reset"
            ? "If an account exists for this email address, a password reset email will be sent."
            : `A confirmation email has been requested${flowEmail ? ` for ${flowEmail}` : ""}. You can sign in before confirming your email.`}
        </Text>
        {resent && <Text accessibilityLiveRegion="polite" className="text-sm text-neutral-500">Another confirmation email has been requested.</Text>}
      </View>
      {emailPurpose === "confirmation" && <Button variant="outlined" loading={busy} disabled={!flowEmail} onPress={resend}>Resend confirmation</Button>}
      <Button disabled={busy} onPress={(): void => router.replace("/account/sign-in")}>Back to Sign In</Button>
    </AuthScreen>
  );
};
