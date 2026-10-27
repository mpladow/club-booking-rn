// File: src/data/auth-session-storage.native.ts
import * as SecureStore from "expo-secure-store";
import { AuthError } from "./auth";
import { type AuthSessionStorage } from "./api-auth";

export const createAuthSessionStorage = (key: string): AuthSessionStorage => {
  // SecureStore restricts key characters. Hex encoding preserves API URL isolation
  // without collisions between punctuation and literal escape sequences.
  const nativeKey: string = `club-booking.${key.split("").map((character: string): string => character.charCodeAt(0).toString(16)).join("-")}`;
  return {
    read: async (): Promise<string | null> => {
      try { return await SecureStore.getItemAsync(nativeKey); } catch {
        throw new AuthError("storage", "Cannot read your sign-in from this device. Please try again.");
      }
    },
    write: async (value: string): Promise<void> => {
      try { await SecureStore.setItemAsync(nativeKey, value); } catch {
        throw new AuthError("storage", "Cannot save your sign-in on this device. Please try again.");
      }
    },
    clear: async (): Promise<void> => {
      try { await SecureStore.deleteItemAsync(nativeKey); } catch {
        throw new AuthError("storage", "Cannot clear your sign-in from this device. Please try again.");
      }
    },
  };
};
