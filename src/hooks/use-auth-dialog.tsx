// File: src/hooks/use-auth-dialog.tsx
import { createContext, useCallback, useContext, useRef, useState, type ComponentRef, type ReactElement, type ReactNode } from "react";
import { type View } from "react-native";
import { AuthDialog, type AuthDialogTab } from "@/components/auth/AuthDialog";
import { BlurTargetView } from "@/components/ui/Blur";
import { useAuth } from "./use-auth";

interface AuthDialogRequest {
  id: number;
  tab: AuthDialogTab;
  checkEmail: boolean;
}
interface AuthDialogContext {
  openAuthDialog: (tab?: AuthDialogTab, checkEmail?: boolean) => void;
}
const Context = createContext<AuthDialogContext | null>(null);

export const AuthDialogProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const { user } = useAuth();
  const [request, setRequest] = useState<AuthDialogRequest | null>(null);
  const sequence = useRef<number>(0);
  const blurTarget = useRef<ComponentRef<typeof View> | null>(null);
  const openAuthDialog = useCallback((tab: AuthDialogTab = "sign-in", checkEmail: boolean = false): void => {
    if (user) return;
    setRequest({ id: ++sequence.current, tab, checkEmail });
  }, [user]);

  return (
    <Context.Provider value={{ openAuthDialog }}>
      <BlurTargetView ref={blurTarget} className="min-h-0 flex-1">{children}</BlurTargetView>
      {request && (
        <AuthDialog
          key={request.id}
          initialTab={request.tab}
          checkEmail={request.checkEmail}
          blurTarget={blurTarget}
          // An older request cannot close a newly opened dialog.
          onClose={(): void => setRequest((current: AuthDialogRequest | null): AuthDialogRequest | null =>
            current?.id === request.id ? null : current)}
        />
      )}
    </Context.Provider>
  );
};

export const useAuthDialog = (): AuthDialogContext => {
  const context: AuthDialogContext | null = useContext(Context);
  if (!context) throw new Error("AuthDialogProvider is required.");
  return context;
};
