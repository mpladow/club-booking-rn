// File: src/hooks/use-administration.tsx
import { router, useFocusEffect, usePathname } from "expo-router";
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from "react";
import { AppState } from "react-native";
import { ApiError } from "@/data/api-auth";
import { administrationErrorMessage, administrationService, sessionExpired, type AdministrationAccess, type AdminSection } from "@/data/administration";
import { useAuth } from "./use-auth";
import { useAuthDialog } from "./use-auth-dialog";

interface AdministrationState {
  clubId: string | null;
  access: AdministrationAccess | null;
  loading: boolean;
  error: string | null;
  notice: string | null;
  clearNotice: () => void;
  refresh: () => Promise<void>;
  handleFailure: (error: unknown) => void;
  denyAccess: () => void;
  leaving: boolean;
}
const Context = createContext<AdministrationState | null>(null);
export const AdministrationProvider = ({ children }: { children: ReactNode }): ReactElement => {
  const { user, signOut } = useAuth();
  const { openAuthDialog } = useAuthDialog();
  const clubId: string | null = user?.clubId ?? null;
  const identity: string = `${user?.id ?? "guest"}:${clubId ?? "none"}`;
  const [result, setResult] = useState<{ identity: string; access: AdministrationAccess | null } | null>(null);
  const [settledIdentity, setSettledIdentity] = useState<string | null>(null);
  const loading: boolean = Boolean(clubId) && settledIdentity !== identity;
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const currentIdentity = useRef<string>(identity);
  const sequence = useRef<number>(0);
  const pathname: string = usePathname();
  const inAdministration = useRef<boolean>(pathname.startsWith("/admin"));
  useLayoutEffect((): void => { currentIdentity.current = identity; inAdministration.current = pathname.startsWith("/admin"); }, [identity, pathname]);
  const needsSignIn = useRef<boolean>(false);
  const [exitRequested, setExitRequested] = useState<boolean>(false);
  const denyAccess = useCallback((): void => {
    setNotice("Your administration access has changed. You have been returned to Bookings.");
    setExitRequested(true);
  }, []);
  useEffect((): void => {
    // Navigate after the denied grants have rendered, disabling unsaved-change guards
    // on screens the user can no longer access.
    if (exitRequested && pathname.startsWith("/admin")) router.replace("/");
  }, [exitRequested, pathname]);
  useEffect((): void => {
    if (needsSignIn.current && !user) { needsSignIn.current = false; openAuthDialog(); }
  }, [user, openAuthDialog]);
  const handleFailure = useCallback((failure: unknown): void => {
    if (currentIdentity.current !== identity) return;
    if (sessionExpired(failure)) {
      // Clear stale UI credentials before requesting the existing Sign In dialog.
      setResult(null);
      setNotice("Your session has expired. Sign in again to continue.");
      needsSignIn.current = true;
      setExitRequested(true);
      void signOut().catch((): void => { setError("Your expired session could not be cleared. Please try signing out again."); });
    } else if (failure instanceof ApiError && failure.status === 403) {
      setResult(null);
      denyAccess();
    }
  }, [signOut, denyAccess, identity]);
  // Keep a stable handler so resource/focus effects do not restart on provider renders.
  const failureRef = useRef(handleFailure);
  useLayoutEffect((): void => { failureRef.current = handleFailure; }, [handleFailure]);
  const refresh = useCallback((): Promise<void> => {
    const started: number = ++sequence.current;
    if (!clubId) return Promise.resolve();
    return administrationService.access(clubId).then((access: AdministrationAccess): void => {
      if (started !== sequence.current || currentIdentity.current !== identity) return;
      setResult({ identity, access });
      setExitRequested(false);
      setError(null);
      if (!access.canAccessAdministration && inAdministration.current) {
        setNotice("You no longer have administration access. You have been returned to Bookings.");
        setExitRequested(true);
      }
    }).catch((failure: unknown): void => {
      if (started !== sequence.current || currentIdentity.current !== identity) return;
      setError(administrationErrorMessage(failure));
      // Fail closed after discovery fails, including transient errors; the route offers Retry.
      setResult(null);
      failureRef.current(failure);
      if (failure instanceof ApiError && failure.status === 404 && inAdministration.current) {
        setNotice("This club is no longer available. You have been returned to Bookings.");
        setExitRequested(true);
      }
    }).finally((): void => {
      if (started === sequence.current && currentIdentity.current === identity) setSettledIdentity(identity);
    });
  }, [clubId, identity]);
  useEffect((): (() => void) => {
    void refresh();
    const subscription = AppState.addEventListener("change", (state): void => { if (state === "active") void refresh(); });
    return (): void => { sequence.current += 1; subscription.remove(); };
  }, [clubId, refresh]);
  return <Context.Provider value={{ clubId, access: result?.identity === identity ? result.access : null, loading, error, notice,
    clearNotice: (): void => setNotice(null), refresh, handleFailure, denyAccess, leaving: exitRequested }}>{children}</Context.Provider>;
};
export const useAdministration = (): AdministrationState => {
  const value: AdministrationState | null = useContext(Context);
  if (!value) throw new Error("AdministrationProvider is required.");
  return value;
};
export const useAdministrationFocus = (section?: AdminSection, edit: boolean = false): boolean => {
  const { access, refresh, loading, error, denyAccess } = useAdministration();
  useFocusEffect(useCallback((): void => { void refresh(); }, [refresh]));
  const allowed: boolean = Boolean(access?.canAccessAdministration && (!section || (access.permissions[section].view && (!edit || access.permissions[section].edit))));
  useEffect((): void => {
    if (!loading && access && !allowed && !error) denyAccess();
  }, [access, allowed, loading, error, denyAccess]);
  return allowed;
};

interface ResourceState<T> { data: T | null; error: string | null; loading: boolean; refreshing: boolean; refresh: () => Promise<void> }
export const useAdministrationResource = <T,>(load: () => Promise<T>, enabled: boolean): ResourceState<T> => {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const sequence = useRef<number>(0);
  const { handleFailure } = useAdministration();
  const failureRef = useRef(handleFailure);
  useLayoutEffect((): void => { failureRef.current = handleFailure; }, [handleFailure]);
  const refresh = useCallback(async (): Promise<void> => {
    if (!enabled) return;
    const started: number = ++sequence.current;
    setRefreshing(true);
    try {
      const next: T = await load();
      if (sequence.current === started) { setData(next); setError(null); }
    } catch (failure: unknown) {
      if (sequence.current === started) { setError(administrationErrorMessage(failure)); failureRef.current(failure); }
    } finally { if (sequence.current === started) { setLoading(false); setRefreshing(false); } }
  }, [load, enabled]);
  useFocusEffect(useCallback((): (() => void) => {
    void refresh();
    return (): void => { sequence.current += 1; };
  }, [refresh]));
  return { data, error, loading, refreshing, refresh };
};

// Mutation responses may arrive after sign-out has replaced the route tree. They must
// not update an unmounted form or navigate a newer session back into administration.
export const useAdministrationLifetime = (): (() => boolean) => {
  const mounted = useRef<boolean>(true);
  useEffect((): (() => void) => {
    mounted.current = true;
    return (): void => { mounted.current = false; };
  }, []);
  return useCallback((): boolean => mounted.current, []);
};
