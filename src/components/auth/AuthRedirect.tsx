// File: src/components/auth/AuthRedirect.tsx
import { Redirect } from "expo-router";
import { useEffect, type ReactElement } from "react";
import { type AuthDialogTab } from "./AuthDialog";
import { useAuthDialog } from "@/hooks/use-auth-dialog";

// Old account URLs remain valid entry points, but no longer render auth pages.
export const AuthRedirect = ({ tab = "sign-in", checkEmail = false }: { tab?: AuthDialogTab; checkEmail?: boolean }): ReactElement => {
  const { openAuthDialog } = useAuthDialog();
  useEffect((): void => { openAuthDialog(tab, checkEmail); }, [openAuthDialog, tab, checkEmail]);
  return <Redirect href="/" />;
};
