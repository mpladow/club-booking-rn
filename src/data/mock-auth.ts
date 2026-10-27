// File: src/data/mock-auth.ts
import {
  AuthError,
  emailError,
  normalizeEmail,
  validateSignUp,
  type AuthService,
  type AuthUser,
  type SignUpInput,
} from "./auth";

export interface MockAuthStorage {
  read: () => Promise<string | null>;
  write: (value: string) => Promise<void>;
}
export interface MockPasswordCodec {
  salt: () => string;
  hash: (password: string, salt: string) => Promise<string>;
}
interface MockAccount {
  user: AuthUser;
  salt: string;
  passwordHash: string;
}
interface FailedAttempts {
  email: string;
  count: number;
}
interface MockState {
  version: 1;
  accounts: MockAccount[];
  attempts: FailedAttempts[];
  session: { userId: string; expiresAt: number } | null;
}
interface MockAuthOptions {
  storage: MockAuthStorage;
  passwords: MockPasswordCodec;
  now?: () => number;
  delay?: () => Promise<void>;
}

const MAX_ATTEMPTS: number = 5;
const SESSION_LIFETIME_MS: number = 7 * 24 * 60 * 60 * 1000;
const resetRequired = (): AuthError => new AuthError("reset-required", "Five unsuccessful attempts. Reset your password before signing in again.", 0);

// This is a device-local test double, not an authentication/security boundary.
// No email links or tokens are invented here: their contract is blocked.
export const createMockAuthService = ({
  storage,
  passwords,
  now = Date.now,
  delay = (): Promise<void> => new Promise<void>((resolve: () => void): void => { setTimeout(resolve, 500); }),
}: MockAuthOptions): AuthService => {
  let queue: Promise<unknown> = Promise.resolve();
  const read = async (): Promise<MockState> => {
    const raw: string | null = await storage.read();
    if (!raw) return { version: 1, accounts: [], attempts: [], session: null };
    const state: MockState = JSON.parse(raw) as MockState;
    if (state.version !== 1 || !Array.isArray(state.accounts) || !Array.isArray(state.attempts))
      throw new Error("Unsupported mock account storage.");
    return state;
  };
  const write = async (state: MockState): Promise<void> => storage.write(JSON.stringify(state));
  // Serialize mutations so concurrent presses cannot lose failed attempts or overwrite a session.
  const run = <T,>(action: () => Promise<T>): Promise<T> => {
    const result: Promise<T> = queue.then(action);
    queue = result.catch((): void => {});
    return result;
  };
  const requestEmail = async (email: string): Promise<void> => {
    if (emailError(email)) throw new AuthError("validation", "Enter a valid email address.");
    await delay();
    // Deliberately identical for known and unknown addresses. Sending a request
    // never unlocks an account; only a completed password reset will do that.
  };
  return {
    restoreSession: (): Promise<AuthUser | null> => run(async (): Promise<AuthUser | null> => {
      const state: MockState = await read();
      if (!state.session) return null;
      const account: MockAccount | undefined = state.accounts.find((entry: MockAccount): boolean => entry.user.id === state.session?.userId);
      if (!account || state.session.expiresAt <= now()) {
        state.session = null;
        await write(state);
        return null;
      }
      return { ...account.user };
    }),
    signIn: (email: string, password: string): Promise<AuthUser> => run(async (): Promise<AuthUser> => {
      if (emailError(email) || !password)
        throw new AuthError("validation", "Enter your email address and password.");
      await delay();
      const state: MockState = await read();
      const normalized: string = normalizeEmail(email);
      let attempts: FailedAttempts | undefined = state.attempts.find((entry: FailedAttempts): boolean => entry.email === normalized);
      if (attempts && attempts.count >= MAX_ATTEMPTS) throw resetRequired();
      const account: MockAccount | undefined = state.accounts.find((entry: MockAccount): boolean => entry.user.email === normalized);
      const matches: boolean = Boolean(account && await passwords.hash(password, account.salt) === account.passwordHash);
      if (!matches || !account) {
        if (!attempts) {
          attempts = { email: normalized, count: 0 };
          state.attempts.push(attempts);
        }
        attempts.count += 1;
        await write(state);
        if (attempts.count >= MAX_ATTEMPTS) throw resetRequired();
        const remaining: number = MAX_ATTEMPTS - attempts.count;
        throw new AuthError("invalid-credentials", "Email or password is incorrect.", remaining);
      }
      state.attempts = state.attempts.filter((entry: FailedAttempts): boolean => entry.email !== normalized);
      state.session = { userId: account.user.id, expiresAt: now() + SESSION_LIFETIME_MS };
      await write(state);
      return { ...account.user };
    }),
    signOut: (): Promise<void> => run(async (): Promise<void> => {
      const state: MockState = await read();
      state.session = null;
      await write(state);
    }),
    signUp: (input: SignUpInput): Promise<void> => run(async (): Promise<void> => {
      if (Object.keys(validateSignUp(input)).length)
        throw new AuthError("validation", "Check your account details.");
      await delay();
      const state: MockState = await read();
      const email: string = normalizeEmail(input.email);
      if (state.accounts.some((entry: MockAccount): boolean => entry.user.email === email))
        throw new AuthError("email-exists", "An account with this email already exists. Sign in or reset your password.");
      const salt: string = passwords.salt();
      const user: AuthUser = {
        id: `mock-${salt}`,
        email,
        displayName: input.displayName.trim(),
      };
      state.accounts.push({ user, salt, passwordHash: await passwords.hash(input.password, salt) });
      await write(state);
    }),
    requestPasswordReset: requestEmail,
    resendConfirmation: requestEmail,
  };
};
