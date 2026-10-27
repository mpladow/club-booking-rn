// File: src/components/auth/ForgotPasswordScreen.tsx
import { router } from "expo-router";
import { useRef, useState, type ReactElement } from "react";
import { Text } from "react-native";
import { AuthField } from "./AuthField";
import { AuthScreen } from "./AuthScreen";
import { Button } from "@/components/ui/Button";
import { authErrorMessage, emailError } from "@/data/auth";
import { useAuth } from "@/hooks/use-auth";

export const ForgotPasswordScreen = (): ReactElement => {
  const { flowEmail, rememberEmail, requestPasswordReset } = useAuth();
  const [email, setEmail] = useState<string>(flowEmail);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const submitting = useRef<boolean>(false);
  const submit = async (): Promise<boolean> => {
    if (submitting.current) return false;
    const invalidEmail: string | undefined = emailError(email);
    setFieldError(invalidEmail);
    if (invalidEmail) return false;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      await requestPasswordReset(email);
      router.replace("/account/check-email");
      return false;
    } catch (failure: unknown) {
      setError(authErrorMessage(failure));
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  return (
    <AuthScreen title="Reset password" busy={busy} error={error}>
      <Text className="text-base font-medium text-neutral-900">Enter your email to request a password reset.</Text>
      <AuthField label="Email" value={email} onChangeText={(value: string): void => { setEmail(value); setFieldError(undefined); setError(null); }} keyboardType="email-address" autoComplete="email" error={fieldError} editable={!busy} returnKeyType="go" onSubmitEditing={(): void => { void submit(); }} />
      <Button loading={busy} onPress={submit}>{busy ? "Requesting reset…" : "Send password reset"}</Button>
      <Button variant="text" disabled={busy} onPress={(): void => { rememberEmail(email.trim()); router.replace("/account/sign-in"); }}>Back to Sign In</Button>
    </AuthScreen>
  );
};
