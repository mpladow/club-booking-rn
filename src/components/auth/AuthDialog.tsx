// File: src/components/auth/AuthDialog.tsx
import { router } from "expo-router";
import { useEffect, useRef, useState, type ComponentRef, type ReactElement, type RefObject } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { AuthField } from "./AuthField";
import { BlurView } from "@/components/ui/Blur";
import { Button } from "@/components/ui/Button";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import {
  AuthError, authErrorMessage, emailError, normalizeEmail, PASSWORD_HELP, validateSignUp,
  type AuthFieldErrors, type SignUpInput,
} from "@/data/auth";
import { useAuth } from "@/hooks/use-auth";

export type AuthDialogTab = "sign-in" | "register";
type Action = AuthDialogTab | "reset" | "resend";
type Notice = "confirmation" | "confirmation-resent" | "reset" | null;
interface AuthDialogProps {
  initialTab: AuthDialogTab;
  checkEmail: boolean;
  blurTarget: RefObject<ComponentRef<typeof View> | null>;
  onClose: () => void;
}

export const AuthDialog = ({ initialTab, checkEmail, blurTarget, onClose }: AuthDialogProps): ReactElement => {
  const { flowEmail, signIn, signUp, requestPasswordReset, resendConfirmation } = useAuth();
  const [tab, setTab] = useState<AuthDialogTab>(initialTab);
  const [input, setInput] = useState<SignUpInput>({
    email: flowEmail, firstName: "", surname: "", displayName: "", password: "", passwordConfirmation: "",
  });
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(checkEmail && flowEmail ? "confirmation" : null);
  const [action, setAction] = useState<Action | null>(null);
  const [lockedEmail, setLockedEmail] = useState<string | null>(null);
  const submitting = useRef<boolean>(false);
  const active = useRef<boolean>(true);
  const scroll = useRef<ComponentRef<typeof ScrollView> | null>(null);
  const busy: boolean = action !== null;
  const registering: boolean = tab === "register";
  const resetRequired: boolean = lockedEmail === normalizeEmail(input.email);
  useEffect((): (() => void) => {
    active.current = true;
    return (): void => { active.current = false; };
  }, []);

  const clearPasswords = (): void => setInput((current: SignUpInput): SignUpInput => ({ ...current, password: "", passwordConfirmation: "" }));
  const changeTab = (next: AuthDialogTab): void => {
    if (submitting.current || next === tab) return;
    setTab(next);
    clearPasswords();
    setErrors({});
    setError(null);
    setNotice(null);
    scroll.current?.scrollTo({ y: 0, animated: false });
  };
  const update = (field: keyof SignUpInput, value: string): void => {
    setInput((current: SignUpInput): SignUpInput => ({ ...current, [field]: value }));
    setErrors((current: AuthFieldErrors): AuthFieldErrors => ({ ...current, [field]: undefined }));
    setError(null);
    if (field === "email") setNotice(null);
  };

  const execute = async (nextAction: Action, work: () => Promise<void>): Promise<boolean> => {
    if (submitting.current) return false;
    submitting.current = true;
    setAction(nextAction);
    setError(null);
    try {
      await work();
    } catch (failure: unknown) {
      if (active.current) {
        setError(authErrorMessage(failure));
        if (nextAction === "sign-in" && failure instanceof AuthError && failure.code === "reset-required") {
          setLockedEmail(normalizeEmail(input.email));
          clearPasswords();
        }
      }
    } finally {
      submitting.current = false;
      if (active.current) setAction(null);
    }
    // The auth provider owns success haptics for these mutations.
    return false;
  };
  const submit = async (): Promise<boolean> => {
    if (submitting.current || (!registering && resetRequired)) return false;
    const fields: AuthFieldErrors = registering ? validateSignUp(input) : {};
    if (!registering) {
      const invalidEmail: string | undefined = emailError(input.email);
      if (invalidEmail) fields.email = invalidEmail;
      if (!input.password) fields.password = "Enter your password.";
    }
    setErrors(fields);
    setError(null);
    setNotice(null);
    if (Object.keys(fields).length) return false;
    return execute(tab, async (): Promise<void> => {
      if (registering) {
        await signUp(input);
        if (active.current) {
          clearPasswords();
          setTab("sign-in");
          setNotice("confirmation");
          scroll.current?.scrollTo({ y: 0, animated: false });
        }
      } else {
        await signIn(input.email, input.password);
        if (active.current) {
          onClose();
          router.replace("/");
        }
      }
    });
  };
  const resetPassword = async (): Promise<boolean> => {
    if (submitting.current) return false;
    const invalidEmail: string | undefined = input.email.trim() ? emailError(input.email) : "Please enter your Email address.";
    setErrors(invalidEmail ? { email: invalidEmail } : {});
    setNotice(null);
    setError(null);
    if (invalidEmail) return false;
    return execute("reset", async (): Promise<void> => {
      await requestPasswordReset(input.email);
      if (active.current) setNotice("reset");
    });
  };
  const resend = (): Promise<boolean> => execute("resend", async (): Promise<void> => {
    await resendConfirmation();
    if (active.current) setNotice("confirmation-resent");
  });

  return (
    <Modal transparent visible animationType="fade" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View className="min-h-0 flex-1">
        <BlurView pointerEvents="none" blurTarget={blurTarget} blurMethod="dimezisBlurView" intensity={45} tint="dark" className="absolute inset-0" />
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss authentication popup" onPress={onClose} className="absolute inset-0 bg-black/20" />
        <SafeAreaView pointerEvents="box-none" className="min-h-0 flex-1">
          <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === "ios" ? "padding" : Platform.OS === "android" ? "height" : undefined} className="min-h-0 flex-1 justify-center px-5 py-6">
            <View testID="auth-dialog" accessibilityViewIsModal accessibilityLabel={registering ? "Register" : "Sign In"} className="max-h-full w-full max-w-lg self-center overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-xl">
              <View className="flex-row items-center justify-between gap-3 border-b border-neutral-200 px-5 py-3">
                <Text accessibilityRole="header" className="text-2xl font-bold tracking-tight text-neutral-900">{registering ? "Register" : "Sign In"}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel="Close authentication popup" onPress={onClose} className="h-10 w-10 items-center justify-center rounded-xl active:opacity-75 focus-visible:outline-2 focus-visible:outline-indigo-600">
                  <Text className="text-2xl text-neutral-500">×</Text>
                </Pressable>
              </View>
              <View accessibilityRole="tablist" className="flex-row border-b border-neutral-200">
                {(["sign-in", "register"] as const).map((value: AuthDialogTab): ReactElement => (
                  <Pressable key={value} accessibilityRole="tab" accessibilityLabel={value === "register" ? "Register" : "Sign In"} accessibilityState={{ selected: tab === value, disabled: busy }} aria-selected={tab === value} disabled={busy} onPress={(): void => changeTab(value)} className={`h-12 flex-1 items-center justify-center border-b-2 active:opacity-75 focus-visible:outline-2 focus-visible:outline-indigo-600 ${tab === value ? "border-indigo-600 bg-indigo-50" : "border-transparent bg-white"}`}>
                    <Text className={`text-base font-semibold ${tab === value ? "text-indigo-600" : "text-neutral-500"}`}>{value === "register" ? "Register" : "Sign In"}</Text>
                  </Pressable>
                ))}
              </View>
              <ScrollView ref={scroll} className="min-h-0 shrink" keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentInsetAdjustmentBehavior="never">
                <View className="gap-5 px-5 pb-6 pt-5">
                  {error && <Text accessibilityRole="alert" className="text-sm text-red-700">{error}</Text>}
                  <AuthField label="Email" value={input.email} onChangeText={(value: string): void => update("email", value)} keyboardType="email-address" autoComplete="email" autoFocus={Platform.OS === "web"} error={errors.email} editable={!busy} />
                  {registering && <>
                    {/* Avoid iOS contact-name autofill interfering with manual name entry. */}
                    <AuthField label="First Name" value={input.firstName} onChangeText={(value: string): void => update("firstName", value)} autoCapitalize="words" autoComplete={Platform.OS === "ios" ? "off" : "given-name"} error={errors.firstName} editable={!busy} maxLength={100} />
                    <AuthField label="Surname" value={input.surname} onChangeText={(value: string): void => update("surname", value)} autoCapitalize="words" autoComplete={Platform.OS === "ios" ? "off" : "family-name"} error={errors.surname} editable={!busy} maxLength={100} />
                    <AuthField label="Display Name" value={input.displayName} onChangeText={(value: string): void => update("displayName", value)} error={errors.displayName} editable={!busy} maxLength={200} />
                  </>}
                  <AuthField key={`${tab}-password`} label="Password" password value={input.password} onChangeText={(value: string): void => update("password", value)} autoComplete={registering ? "new-password" : "current-password"} hint={registering ? PASSWORD_HELP : undefined} error={errors.password} editable={!busy && (registering || !resetRequired)} returnKeyType={registering ? "next" : "go"} onSubmitEditing={registering ? undefined : (): void => { void submit(); }} />
                  {registering && <AuthField label="Confirm Password" password value={input.passwordConfirmation} onChangeText={(value: string): void => update("passwordConfirmation", value)} autoComplete="new-password" error={errors.passwordConfirmation} editable={!busy} returnKeyType="go" onSubmitEditing={(): void => { void submit(); }} />}
                  {!registering && notice === "reset" && <Text accessibilityLiveRegion="polite" className="text-sm text-neutral-500">An password reset has been sent to the email provided.</Text>}
                  {!registering && (notice === "confirmation" || notice === "confirmation-resent") && (
                    <View accessibilityLiveRegion="polite" className="gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4">
                      <Text className="text-lg font-semibold text-neutral-900">Check your email</Text>
                      <Text className="text-sm text-neutral-500">{notice === "confirmation-resent" ? "Another confirmation email has been requested. You can sign in before confirming your email." : "A confirmation email has been requested. You can sign in before confirming your email."}</Text>
                      <Button variant="text" loading={action === "resend"} disabled={busy && action !== "resend"} onPress={resend}>Resend confirmation</Button>
                    </View>
                  )}
                  <Button loading={action === tab} disabled={(busy && action !== tab) || (!registering && resetRequired)} onPress={submit}>{registering ? action === "register" ? "Creating account…" : "Register" : resetRequired ? "Password reset required" : action === "sign-in" ? "Signing in…" : "Sign In"}</Button>
                  {!registering && <Button variant="text" loading={action === "reset"} disabled={busy && action !== "reset"} onPress={resetPassword}>{action === "reset" ? "Sending reset…" : "Reset password"}</Button>}
                </View>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </View>
    </Modal>
  );
};
