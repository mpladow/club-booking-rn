// File: src/app/(tabs)/account/sign-up.tsx
import { type ReactElement } from "react";
import { AuthRedirect } from "@/components/auth/AuthRedirect";

const RegisterRedirect = (): ReactElement => <AuthRedirect tab="register" />;
export default RegisterRedirect;
