// File: src/components/auth/SignUpScreen.tsx
import { router } from "expo-router";
import { useRef, useState, type ReactElement } from "react";
import { AuthField } from "./AuthField";
import { AuthScreen } from "./AuthScreen";
import { Button } from "@/components/ui/Button";
import { authErrorMessage, PASSWORD_HELP, validateSignUp, type AuthFieldErrors, type SignUpInput } from "@/data/auth";
import { useAuth } from "@/hooks/use-auth";

export const SignUpScreen = (): ReactElement => {
  const { flowEmail, signUp } = useAuth();
  const [input, setInput] = useState<SignUpInput>({ email: flowEmail, firstName: "", surname: "", password: "", passwordConfirmation: "" });
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);
  const submitting = useRef<boolean>(false);
  const update = (field: keyof SignUpInput, value: string): void => {
    setInput((current: SignUpInput): SignUpInput => ({ ...current, [field]: value }));
    setErrors((current: AuthFieldErrors): AuthFieldErrors => ({ ...current, [field]: undefined }));
    setError(null);
  };
  const submit = async (): Promise<boolean> => {
    if (submitting.current) return false;
    const fields: AuthFieldErrors = validateSignUp(input);
    setErrors(fields);
    if (Object.keys(fields).length) return false;
    setError(null);
    submitting.current = true;
    setBusy(true);
    try {
      await signUp(input);
      setInput((current: SignUpInput): SignUpInput => ({ ...current, password: "", passwordConfirmation: "" }));
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
    <AuthScreen title="Sign Up" busy={busy} error={error}>
      <AuthField label="Email" value={input.email} onChangeText={(value: string): void => update("email", value)} keyboardType="email-address" autoComplete="email" error={errors.email} editable={!busy} />
      <AuthField label="First Name" value={input.firstName} onChangeText={(value: string): void => update("firstName", value)} autoCapitalize="words" autoComplete="given-name" error={errors.firstName} editable={!busy} maxLength={100} />
      <AuthField label="Surname" value={input.surname} onChangeText={(value: string): void => update("surname", value)} autoCapitalize="words" autoComplete="family-name" error={errors.surname} editable={!busy} maxLength={100} />
      <AuthField label="Password" password value={input.password} onChangeText={(value: string): void => update("password", value)} autoComplete="new-password" hint={PASSWORD_HELP} error={errors.password} editable={!busy} />
      <AuthField label="Confirm Password" password value={input.passwordConfirmation} onChangeText={(value: string): void => update("passwordConfirmation", value)} autoComplete="new-password" error={errors.passwordConfirmation} editable={!busy} returnKeyType="go" onSubmitEditing={(): void => { void submit(); }} />
      <Button loading={busy} onPress={submit}>{busy ? "Creating account…" : "Sign Up"}</Button>
      <Button variant="text" disabled={busy} onPress={(): void => router.replace("/account/sign-in")}>Back to Sign In</Button>
    </AuthScreen>
  );
};
