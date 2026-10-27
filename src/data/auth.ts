// File: src/data/auth.ts
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
}

export interface SignUpInput {
  email: string;
  firstName: string;
  surname: string;
  displayName: string;
  password: string;
  passwordConfirmation: string;
}

export type AuthField = keyof SignUpInput;
export type AuthFieldErrors = Partial<Record<AuthField, string>>;
export type AuthErrorCode = "invalid-credentials" | "reset-required" | "email-exists" | "validation"
  | "network" | "storage" | "service" | "rate-limited" | "session-expired";

export class AuthError extends Error {
  constructor(
    public readonly code: AuthErrorCode,
    message: string,
    public readonly attemptsRemaining?: number,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

// The UI depends on this contract; the app supplies the real API adapter.
// Email-link consumption is intentionally excluded until the link contract is supplied.
export interface AuthService {
  restoreSession: () => Promise<AuthUser | null>;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  signUp: (input: SignUpInput) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resendConfirmation: (email: string) => Promise<void>;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();
export const emailError = (email: string): string | undefined =>
  email.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ? undefined
    : "Enter a valid email address.";

export const PASSWORD_HELP: string = "Use 12–128 characters, including an uppercase letter, a lowercase letter, a number and a symbol.";
export const passwordError = (password: string): string | undefined =>
  password.length >= 12 && password.length <= 128 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password) && /[^a-zA-Z0-9\s]/.test(password)
    ? undefined
    : PASSWORD_HELP;

export const validateSignUp = (input: SignUpInput): AuthFieldErrors => {
  const errors: AuthFieldErrors = {};
  const email: string | undefined = emailError(input.email);
  const password: string | undefined = passwordError(input.password);
  if (email) errors.email = email;
  if (!input.firstName.trim() || input.firstName.trim().length > 100)
    errors.firstName = "Enter a first name of 100 characters or fewer.";
  if (!input.surname.trim() || input.surname.trim().length > 100)
    errors.surname = "Enter a surname of 100 characters or fewer.";
  if (!input.displayName.trim() || input.displayName.trim().length > 200)
    errors.displayName = "Enter a display name of 200 characters or fewer.";
  if (password) errors.password = password;
  if (!input.passwordConfirmation || input.password !== input.passwordConfirmation)
    errors.passwordConfirmation = "Passwords must match.";
  return errors;
};

export const authErrorMessage = (error: unknown): string =>
  error instanceof AuthError ? error.message : "Something went wrong. Please try again.";
