// File: src/data/auth-session-storage.ts
import { AuthError } from "./auth";
import { type AuthSessionStorage } from "./api-auth";

export const createAuthSessionStorage = (key: string): AuthSessionStorage => ({
  read: (): string | null => {
    // Static rendering has no browser storage and starts as a guest.
    if (typeof window === "undefined") return null;
    try { return window.localStorage.getItem(key); } catch {
      throw new AuthError("storage", "Cannot read your sign-in. Allow browser storage and try again.");
    }
  },
  write: (value: string): void => {
    try { window.localStorage.setItem(key, value); } catch {
      throw new AuthError("storage", "Cannot save your sign-in. Allow browser storage and try again.");
    }
  },
  clear: (): void => {
    if (typeof window === "undefined") return;
    try { window.localStorage.removeItem(key); } catch {
      throw new AuthError("storage", "Cannot clear your sign-in. Allow browser storage and try again.");
    }
  },
});
