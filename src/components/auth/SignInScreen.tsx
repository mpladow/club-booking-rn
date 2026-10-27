// File: src/components/auth/SignInScreen.tsx
import { router } from "expo-router";
import { useRef, useState, type ReactElement } from "react";
import { AuthField } from "./AuthField";
import { AuthScreen } from "./AuthScreen";
import { Button } from "@/components/ui/Button";
import { AuthError, authErrorMessage, emailError, normalizeEmail, type AuthFieldErrors } from "@/data/auth";
import { useAuth } from "@/hooks/use-auth";

export const SignInScreen = (): ReactElement => {
  const { flowEmail, rememberEmail, signIn } = useAuth();
  const [email, setEmail] = useState<string>(flowEmail);
  const [password, setPassword] = useState<string>("");
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);
  const submitting = useRef<boolean>(false);
  const resetRequired: boolean = lockedEmail === normalizeEmail(email);
  const submit = async (): Promise<boolean> => {
    if (submitting.current || resetRequired) return false;
    const fields: AuthFieldErrors = {};
    const invalidEmail: string | undefined = emailError(email);
    if (invalidEmail) fields.email = invalidEmail;
    if (!password) fields.password = "Enter your password.";
    setErrors(fields);
    setError(null);
    if (Object.keys(fields).length) return false;
    submitting.current = true;
    setBusy(true);
    try {
      await signIn(email, password);
      setPassword("");
      router.replace("/");
      // Auth mutations own their haptics, including keyboard submissions.
      return false;
    } catch (failure: unknown) {
      setError(authErrorMessage(failure));
      if (failure instanceof AuthError && failure.code === "reset-required") {
        setLockedEmail(normalizeEmail(email));
        setPassword("");
      }
      return false;
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  };
  const openReset = (): void => {
    rememberEmail(email.trim());
    setPassword("");
    router.push("/account/forgot-password");
  };
  return (
    <AuthScreen title="Sign In" busy={busy} error={error}>
      <AuthField label="Email" value={email} onChangeText={(value: string): void => { setEmail(value); setError(null); setErrors({}); }} keyboardType="email-address" autoComplete="email" error={errors.email} editable={!busy} />
      <AuthField label="Password" password value={password} onChangeText={setPassword} autoComplete="current-password" error={errors.password} editable={!busy && !resetRequired} returnKeyType="go" onSubmitEditing={(): void => { void submit(); }} />
      <Button loading={busy} disabled={resetRequired} onPress={submit}>{resetRequired ? "Password reset required" : busy ? "Signing in…" : "Sign In"}</Button>
      <Button variant="outlined" disabled={busy} onPress={openReset}>{resetRequired ? "Reset password to continue" : "Reset password"}</Button>
      <Button variant="text" disabled={busy} onPress={(): void => { rememberEmail(email.trim()); setPassword(""); router.push("/account/sign-up"); }}>Sign Up</Button>
    </AuthScreen>
  );
};
