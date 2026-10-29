// File: src/data/api-auth.ts
import {
  AuthError, ClubSelectionError, emailError, normalizeEmail, validateSignUp,
  type AuthErrorCode, type AuthService, type AuthUser, type SignUpInput,
} from "./auth";

export interface AuthSessionStorage {
  read: () => string | null | Promise<string | null>;
  write: (value: string) => void | Promise<void>;
  clear: () => void | Promise<void>;
}

interface Session {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  clubId: string | null;
}

interface ApiAuthOptions {
  baseUrl: string;
  storage: AuthSessionStorage;
  fetcher?: typeof fetch;
  now?: () => number;
}

export interface ApiAuthService extends AuthService {
  resource: (path: string, options?: ResourceRequest) => Promise<ApiResource>;
  get: (path: string) => Promise<unknown>;
  post: (path: string, body: object) => Promise<unknown>;
  put: (path: string, body: object) => Promise<unknown>;
  delete: (path: string) => Promise<unknown>;
}
export interface ResourceRequest { method?: "GET" | "POST" | "PUT" | "DELETE"; body?: object; ifMatch?: string }
export interface ApiResource { value: unknown; etag: string | null }

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export class ApiError extends AuthError {
  constructor(public readonly status: number, code: AuthErrorCode, message: string, public readonly serverCode?: string) {
    super(code, message);
  }
}

// Tokens are opaque ASP.NET Core bearer tokens. Never decode them as JWTs.
export const createApiAuthService = ({ baseUrl, storage, fetcher = fetch, now = Date.now }: ApiAuthOptions): ApiAuthService => {
  const origin: string = baseUrl.replace(/\/+$/, "");
  let generation: number = 0;
  let restoring: Promise<AuthUser | null> | null = null;
  let storagePending: Promise<void> = Promise.resolve();

  // Native storage is asynchronous. Serialize operations so an in-flight token
  // write completes before sign-out deletes it, and allow retries after failures.
  const withStorage = <T,>(operation: () => T | Promise<T>): Promise<T> => {
    const pending: Promise<T> = storagePending.then(operation);
    storagePending = pending.then((): void => {}, (): void => {});
    return pending;
  };

  const request = async (path: string, body?: object, accessToken?: string, prefix: string = "/auth", method?: string, metadata: boolean = false, ifMatch?: string): Promise<unknown> => {
    const controller: AbortController = new AbortController();
    const timeout: ReturnType<typeof setTimeout> = setTimeout((): void => controller.abort(), 15000);
    let response: Response;
    let result: unknown;
    try {
      response = await fetcher(`${origin}${prefix}${path}`, {
        method: method ?? (body === undefined ? "GET" : "POST"),
        credentials: "omit",
        headers: {
          Accept: "application/json",
          ...(body === undefined ? {} : { "Content-Type": "application/json" }),
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          ...(ifMatch ? { "If-Match": ifMatch } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
      // Some errors (for example a rejected refresh token) have an empty body.
      const text: string = await response.text();
      try { result = text ? JSON.parse(text) as unknown : null; } catch { result = null; }
    } catch {
      throw new AuthError("network", "Cannot reach the service. Check your connection and try again.");
    } finally {
      clearTimeout(timeout);
    }
    if (response.ok) return metadata ? { value: result, etag: response.headers.get("ETag") } : result;
    if (response.status === 409 && isRecord(result) && result.code === "ClubSelectionRequired" && Array.isArray(result.clubs)) {
      const clubs = result.clubs.filter((club: unknown): club is { id: string; name: string } => isRecord(club)
        && typeof club.id === "string" && /^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(club.id) && typeof club.name === "string");
      if (clubs.length) throw new ClubSelectionError(clubs);
    }
    if (response.status === 401)
      throw new ApiError(401, prefix === "" ? "session-expired" : "invalid-credentials", prefix === ""
        ? "Your session has expired. Sign in again to continue."
        : "Email or password is incorrect. If your account is locked, reset your password.");
    if (response.status === 429)
      throw new ApiError(429, "rate-limited", "Too many requests. Please wait a moment and try again.");
    if (prefix === "" && isRecord(result) && typeof result.code === "string")
      throw new ApiError(response.status, "service", "The request could not be completed.", result.code);
    if (prefix === "" && response.status === 404)
      throw new ApiError(404, "service", "This club or booking is no longer available. Sign in again or refresh and try again.");
    if (response.status === 400 && isRecord(result) && isRecord(result.errors)) {
      const duplicate: boolean = "DuplicateEmail" in result.errors || "DuplicateUserName" in result.errors;
      const messages: string[] = Object.values(result.errors).flatMap((value: unknown): string[] =>
        Array.isArray(value) ? value.filter((message: unknown): message is string => typeof message === "string") : []);
      throw new ApiError(400, duplicate ? "email-exists" : "validation",
        messages.join(" ") || "Check your account details and try again.");
    }
    throw new ApiError(response.status, "service", "The service is unavailable. Please try again.");
  };

  const parseTokens = (value: unknown): Session => {
    if (!isRecord(value) || value.tokenType !== "Bearer" || typeof value.accessToken !== "string"
      || !value.accessToken || typeof value.refreshToken !== "string" || !value.refreshToken
      || typeof value.expiresIn !== "number" || !Number.isFinite(value.expiresIn) || value.expiresIn <= 0)
      throw new AuthError("service", "The sign-in service returned an invalid session. Please try again.");
    return { accessToken: value.accessToken, refreshToken: value.refreshToken, expiresAt: now() + value.expiresIn * 1000,
      clubId: typeof value.clubId === "string" ? value.clubId : null };
  };

  const readSession = async (started: number): Promise<Session | null> => {
    if (started !== generation) return null;
    const raw: string | null = await storage.read();
    if (started !== generation) return null;
    if (!raw) return null;
    let value: unknown;
    try { value = JSON.parse(raw) as unknown; } catch { value = null; }
    if (isRecord(value) && typeof value.accessToken === "string" && value.accessToken
      && typeof value.refreshToken === "string" && value.refreshToken
      && typeof value.expiresAt === "number" && Number.isFinite(value.expiresAt))
      return { accessToken: value.accessToken, refreshToken: value.refreshToken, expiresAt: value.expiresAt,
        clubId: typeof value.clubId === "string" ? value.clubId : null };
    await storage.clear();
    return null;
  };

  const profile = async (session: Session): Promise<AuthUser> => {
    const value: unknown = await request("/me", undefined, session.accessToken);
    if (!isRecord(value) || typeof value.userId !== "string" || !value.userId
      || typeof value.email !== "string" || typeof value.displayName !== "string"
      || (value.clubId != null && (typeof value.clubId !== "string" || !/^[\da-f]{8}(-[\da-f]{4}){3}-[\da-f]{12}$/i.test(value.clubId))))
      throw new AuthError("service", "The sign-in service returned an invalid profile. Please try again.");
    return { id: value.userId, email: value.email, displayName: value.displayName, clubId: typeof value.clubId === "string" ? value.clubId : null };
  };

  const restore = async (): Promise<AuthUser | null> => {
    const started: number = generation;
    let refreshed: boolean = false;
    const refresh = async (current: Session): Promise<Session> => {
      const next: Session = parseTokens(await request("/refresh", { refreshToken: current.refreshToken }));
      refreshed = true;
      // Sign-out or a newer sign-in must win over an outstanding refresh.
      await withStorage(async (): Promise<void> => {
        if (started === generation) await storage.write(JSON.stringify(next));
      });
      return next;
    };
    try {
      let session: Session | null = await withStorage((): Promise<Session | null> => readSession(started));
      if (!session || started !== generation) return null;
      if (session.expiresAt <= now() + 30000) session = await refresh(session);
      if (started !== generation) return null;
      let user: AuthUser;
      try {
        user = await profile(session);
      } catch (error: unknown) {
        if (!(error instanceof ApiError) || error.status !== 401 || refreshed) throw error;
        session = await refresh(session);
        if (started !== generation) return null;
        user = await profile(session);
      }
      await withStorage(async (): Promise<void> => {
        if (started === generation) await storage.write(JSON.stringify({ ...session, clubId: user.clubId }));
      });
      return started === generation ? user : null;
    } catch (error: unknown) {
      if (started !== generation) return null;
      if (error instanceof ApiError && error.status === 401) {
        await withStorage(async (): Promise<void> => {
          if (started === generation) await storage.clear();
        });
        return null;
      }
      // Keep credentials on transient failures so Retry can recover the session.
      throw error;
    }
  };

  const requestEmail = async (path: string, email: string): Promise<void> => {
    if (emailError(email)) throw new AuthError("validation", "Enter a valid email address.");
    await request(path, { email: normalizeEmail(email) });
  };

  const restoreSession = (): Promise<AuthUser | null> => {
    // React may mount the provider twice in development; share the refresh.
    if (!restoring) {
      const pending: Promise<AuthUser | null> = restore();
      restoring = pending;
      void pending.finally((): void => { if (restoring === pending) restoring = null; }).catch((): void => {});
    }
    return restoring;
  };

  const authenticatedRequest = async (path: string, body?: object, method?: string, metadata: boolean = false, ifMatch?: string): Promise<unknown> => {
      const started: number = generation;
      const session = async (refresh: boolean): Promise<Session> => {
        let current: Session | null = await withStorage((): Promise<Session | null> => readSession(started));
        if (current && (refresh || current.expiresAt <= now() + 30000)) {
          await restoreSession();
          current = await withStorage((): Promise<Session | null> => readSession(started));
        }
        if (!current || started !== generation)
          throw new AuthError("session-expired", "Sign in again to continue.");
        return current;
      };
      let current: Session = await session(false);
      let result: unknown;
      try {
        result = await request(path, body, current.accessToken, "", method, metadata, ifMatch);
      } catch (error: unknown) {
        if (!(error instanceof ApiError) || error.status !== 401) throw error;
        current = await session(true);
        result = await request(path, body, current.accessToken, "", method, metadata, ifMatch);
      }
      if (started !== generation) throw new AuthError("session-expired", "Sign-in was cancelled. Please try again.");
      return result;
  };

  return {
    restoreSession,
    resource: async (path: string, options: ResourceRequest = {}): Promise<ApiResource> =>
      await authenticatedRequest(path, options.body, options.method, true, options.ifMatch) as ApiResource,
    get: (path: string): Promise<unknown> => authenticatedRequest(path),
    post: (path: string, body: object): Promise<unknown> => authenticatedRequest(path, body),
    put: (path: string, body: object): Promise<unknown> => authenticatedRequest(path, body, "PUT"),
    delete: (path: string): Promise<unknown> => authenticatedRequest(path, undefined, "DELETE"),
    signIn: async (email: string, password: string, clubId?: string): Promise<AuthUser> => {
      if (emailError(email) || !password || password.length > 128)
        throw new AuthError("validation", "Enter your email address and password.");
      const started: number = ++generation;
      restoring = null;
      const session: Session = parseTokens(await request("/login", { email: normalizeEmail(email), password, ...(clubId ? { clubId } : {}) }));
      const user: AuthUser = await profile(session);
      if (started !== generation) throw new AuthError("session-expired", "Sign-in was cancelled. Please try again.");
      // Save routing context with the tokens only after the authenticated profile succeeds.
      await withStorage(async (): Promise<void> => {
        if (started === generation) await storage.write(JSON.stringify({ ...session, clubId: user.clubId }));
      });
      if (started !== generation) throw new AuthError("session-expired", "Sign-in was cancelled. Please try again.");
      return user;
    },
    signOut: async (): Promise<void> => {
      generation += 1;
      restoring = null;
      await withStorage((): void | Promise<void> => storage.clear());
    },
    signUp: async (input: SignUpInput): Promise<void> => {
      if (Object.keys(validateSignUp(input)).length) throw new AuthError("validation", "Check your account details.");
      await request("/register", {
        email: normalizeEmail(input.email), password: input.password,
        firstName: input.firstName.trim(), surname: input.surname.trim(), displayName: input.displayName.trim(),
      });
    },
    requestPasswordReset: (email: string): Promise<void> => requestEmail("/forgot-password", email),
    resendConfirmation: (email: string): Promise<void> => requestEmail("/resend-confirmation", email),
  };
};
