// File: src/constants/navigation.ts
export const CLUB_NAME: string = "Club Booking";
export const WIDE_NAVIGATION_MIN_WIDTH: number = 1024;

export interface AppTab {
  name: "index" | "settings" | "admin";
  label: string;
  href: "/" | "/settings" | "/admin";
}

export const APP_TABS: readonly AppTab[] = [
  { name: "index", label: "Bookings", href: "/" },
  { name: "settings", label: "Settings", href: "/settings" },
  { name: "admin", label: "Admin", href: "/admin" },
];

export const PAGE_SUBTITLES: Readonly<Record<string, string>> = {
  "Sign In": "Welcome back to the table.",
  Register: "Create your club account.",
  "Reset password": "Get back into your account.",
  "Check your email": "Your next step is in your inbox.",
  "Your bookings": "A place at the table, all day.",
  Settings: "More settings will be available here soon.",
  "Select date": "Your table is reserved for the whole day.",
  "Select table": "Pick a place for your next game.",
  "Additional information": "Let others know what you have planned.",
  "Confirm booking": "Review your details. Tap any row to make changes.",
};
