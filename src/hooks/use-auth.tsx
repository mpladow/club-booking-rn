// File: src/hooks/use-auth.tsx
import { createContext, useContext, useEffect, useState, type ReactElement, type ReactNode } from "react";
import { authService } from "@/data/auth-service";
import { normalizeEmail, type AuthUser, type SignUpInput } from "@/data/auth";
import * as Haptics from "expo-haptics";
import { Platform } from "react-native";

const successHaptic = (): void => {
  if (Platform.OS !== "web")
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch((): void => {});
};

export type EmailPurpose = "confirmation" | "reset";
interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  restoreError: boolean;
  restore: () => Promise<void>;
  flowEmail: string;
  emailPurpose: EmailPurpose;
  rememberEmail: (email: string) => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendConfirmation: () => Promise<void>;
}
const Context = createContext<AuthState | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [restoreError, setRestoreError] = useState<boolean>(false);
  const [flowEmail, setFlowEmail] = useState<string>("");
  const [emailPurpose, setEmailPurpose] = useState<EmailPurpose>("confirmation");
  const restore = async (): Promise<void> => {
    setLoading(true);
    setRestoreError(false);
    try {
      setUser(await authService.restoreSession());
    } catch {
      setRestoreError(true);
    } finally {
      setLoading(false);
    }
  };
  useEffect((): (() => void) => {
    let active: boolean = true;
    void authService.restoreSession()
      .then((restored: AuthUser | null): void => { if (active) setUser(restored); })
      .catch((): void => { if (active) setRestoreError(true); })
      .finally((): void => { if (active) setLoading(false); });
    return (): void => { active = false; };
  }, []);
  const signIn = async (email: string, password: string): Promise<void> => {
    const signedIn: AuthUser = await authService.signIn(email, password);
    setFlowEmail(normalizeEmail(email));
    setUser(signedIn);
    successHaptic();
  };
  const signOut = async (): Promise<void> => {
    await authService.signOut();
    setUser(null);
    setFlowEmail("");
    successHaptic();
  };
  const signUp = async (input: SignUpInput): Promise<void> => {
    await authService.signUp(input);
    setFlowEmail(normalizeEmail(input.email));
    setEmailPurpose("confirmation");
    successHaptic();
  };
  const requestPasswordReset = async (email: string): Promise<void> => {
    await authService.requestPasswordReset(email);
    setFlowEmail(normalizeEmail(email));
    setEmailPurpose("reset");
    successHaptic();
  };
  return (
    <Context.Provider value={{
      user, loading, restoreError, restore, flowEmail, emailPurpose,
      rememberEmail: setFlowEmail, signIn, signOut, signUp, requestPasswordReset,
      resendConfirmation: async (): Promise<void> => { await authService.resendConfirmation(flowEmail); successHaptic(); },
    }}>
      {children}
    </Context.Provider>
  );
};

export const useAuth = (): AuthState => {
  const value: AuthState | null = useContext(Context);
  if (!value) throw new Error("AuthProvider is required.");
  return value;
};
