// File: src/data/auth-service.ts
import { createApiAuthService, type ApiAuthService } from "./api-auth";
import { createAuthSessionStorage } from "./auth-session-storage";

const baseUrl: string = process.env.EXPO_PUBLIC_API_BASE_URL?.trim() || "https://localhost:7145";
// Isolate real tokens from old mock data and from other API environments.
const storageKey: string = `club-booking:auth:v1:${baseUrl.replace(/\/+$/, "")}`;

// Metro selects SecureStore on native and browser storage on web.
export const authService: ApiAuthService = createApiAuthService({ baseUrl, storage: createAuthSessionStorage(storageKey) });
