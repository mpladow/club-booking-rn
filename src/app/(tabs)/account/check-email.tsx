// File: src/app/(tabs)/account/check-email.tsx
import { type ReactElement } from "react";
import { AuthRedirect } from "@/components/auth/AuthRedirect";

const CheckEmailRedirect = (): ReactElement => <AuthRedirect checkEmail />;
export default CheckEmailRedirect;
