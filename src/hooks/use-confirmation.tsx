// File: src/hooks/use-confirmation.tsx
import { useIsFocused, usePreventRemove } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { Modal, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "@/components/ui/SafeAreaView";
import { Button } from "@/components/ui/Button";

interface Confirmation { title: string; message: string; accept: string }
interface ConfirmationRequest extends Confirmation { resolve: (accepted: boolean) => void }
interface ConfirmationState {
  confirm: (options: Confirmation) => Promise<boolean>;
  navigate: (action: () => void | Promise<void>) => Promise<void>;
  registerGuard: (guard: () => Promise<boolean>) => () => void;
}
const Context = createContext<ConfirmationState | null>(null);
export const ConfirmationProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const [request, setRequest] = useState<ConfirmationRequest | null>(null);
  const pending = useRef<ConfirmationRequest | null>(null);
  const guard = useRef<(() => Promise<boolean>) | null>(null);
  const navigating = useRef<boolean>(false);
  const confirm = useCallback((options: Confirmation): Promise<boolean> => {
    if (pending.current) return Promise.resolve(false);
    return new Promise<boolean>((resolve): void => {
      const next: ConfirmationRequest = { ...options, resolve };
      pending.current = next;
      setRequest(next);
    });
  }, []);
  const close = (accepted: boolean): void => {
    const current: ConfirmationRequest | null = pending.current;
    pending.current = null;
    setRequest(null);
    current?.resolve(accepted);
  };
  useEffect((): (() => void) => (): void => { pending.current?.resolve(false); }, []);
  const registerGuard = useCallback((next: () => Promise<boolean>): (() => void) => {
    guard.current = next;
    return (): void => { if (guard.current === next) guard.current = null; };
  }, []);
  const navigate = useCallback(async (action: () => void | Promise<void>): Promise<void> => {
    if (navigating.current) return;
    navigating.current = true;
    try { if (!guard.current || await guard.current()) await action(); }
    finally { navigating.current = false; }
  }, []);
  return (
    <Context.Provider value={{ confirm, navigate, registerGuard }}>
      {children}
      <Modal visible={Boolean(request)} transparent animationType="fade" onRequestClose={(): void => close(false)}>
        <SafeAreaView className="flex-1 items-center justify-center bg-black/40 px-5">
          <Pressable accessibilityRole="button" accessibilityLabel="Cancel confirmation" onPress={(): void => close(false)} className="absolute inset-0" />
          <View accessibilityViewIsModal className="max-h-full w-full max-w-md gap-5 rounded-2xl border border-neutral-200 bg-white p-6">
            <ScrollView className="min-h-0 grow-0 shrink" keyboardShouldPersistTaps="handled"><View className="gap-5">
              <Text accessibilityRole="header" className="text-lg font-semibold text-neutral-900">{request?.title}</Text>
              <Text className="text-base text-neutral-600">{request?.message}</Text>
            </View></ScrollView>
            <Button onPress={(): void => close(true)}>{request?.accept ?? "Continue"}</Button>
            <Button variant="outlined" onPress={(): void => close(false)}>Cancel</Button>
          </View>
        </SafeAreaView>
      </Modal>
    </Context.Provider>
  );
};
export const useConfirmation = (): ConfirmationState => {
  const value: ConfirmationState | null = useContext(Context);
  if (!value) throw new Error("ConfirmationProvider is required.");
  return value;
};

// Router removal covers hardware/browser Back and reload. Custom navigation also guards
// tab changes, which blur the form without removing its stack entry.
export const useUnsavedChanges = (dirty: boolean, discard: () => void, saving: boolean = false): { markSaved: () => void } => {
  const { confirm, registerGuard } = useConfirmation();
  const focused: boolean = useIsFocused();
  const dirtyRef = useRef<boolean>(dirty);
  const discardRef = useRef(discard);
  const savingRef = useRef<boolean>(saving);
  useLayoutEffect((): void => { dirtyRef.current = dirty; discardRef.current = discard; savingRef.current = saving; }, [dirty, discard, saving]);
  const disableRef = useRef<() => void>((): void => {});
  const markSaved = useCallback((): void => {
    dirtyRef.current = false;
    disableRef.current();
  }, []);
  const allowLeave = useCallback(async (): Promise<boolean> => {
    if (savingRef.current) return false;
    if (!dirtyRef.current) return true;
    if (!await confirm({ title: "Discard changes?", message: "Your unsaved changes will be lost.", accept: "Discard changes" })) return false;
    discardRef.current();
    markSaved();
    return true;
  }, [confirm, markSaved]);
  const disable = usePreventRemove((dirty || saving) && focused, ({ repeat }): void => {
    void allowLeave().then((accepted: boolean): void => { if (accepted) repeat(); });
  });
  useLayoutEffect((): void => { disableRef.current = disable; }, [disable]);
  useEffect((): (() => void) | undefined => focused ? registerGuard(allowLeave) : undefined, [focused, registerGuard, allowLeave]);
  return { markSaved };
};
