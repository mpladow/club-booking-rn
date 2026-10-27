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
  password: string;
  passwordConfirmation: string;
}

export type AuthField = keyof SignUpInput;
export type AuthFieldErrors = Partial<Record<AuthField, string>>;
export type AuthErrorCode = "invalid-credentials" | "reset-required" | "email-exists" | "validation";

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

// The UI depends on this contract so the mock can be replaced by an API adapter.
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

export const PASSWORD_HELP: string = "Use 12–128 characters, including a number and a symbol. Uppercase and lowercase letters are optional.";
export const passwordError = (password: string): string | undefined =>
  password.length >= 12 && password.length <= 128 && /[0-9]/.test(password) && /[^a-zA-Z0-9\s]/.test(password)
    ? undefined
    : "Use 12–128 characters with at least one number and one symbol.";

export const validateSignUp = (input: SignUpInput): AuthFieldErrors => {
  const errors: AuthFieldErrors = {};
  const email: string | undefined = emailError(input.email);
  const password: string | undefined = passwordError(input.password);
  if (email) errors.email = email;
  if (!input.firstName.trim() || input.firstName.trim().length > 100)
    errors.firstName = "Enter a first name of 100 characters or fewer.";
  if (!input.surname.trim() || input.surname.trim().length > 100)
    errors.surname = "Enter a surname of 100 characters or fewer.";
  if (`${input.firstName.trim()} ${input.surname.trim()}`.length > 200)
    errors.surname = "Use 200 characters or fewer for your full name.";
  if (password) errors.password = password;
  if (!input.passwordConfirmation || input.password !== input.passwordConfirmation)
    errors.passwordConfirmation = "Passwords must match.";
  return errors;
};

export const authErrorMessage = (error: unknown): string =>
  error instanceof AuthError ? error.message : "Something went wrong. Please try again.";
