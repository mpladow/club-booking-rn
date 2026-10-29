// File: src/constants/administration.ts
import { type AdminSection } from "@/data/administration";
import { type MenuTileIcon } from "@/components/ui/MenuTile";
export interface AdminMenuItem {
  section: AdminSection; title: string; subtitle: string;
  icon: MenuTileIcon;
  href: "/admin/club-details" | "/admin/schedule" | "/admin/tables" | "/admin/users";
}
export const ADMIN_MENU: readonly AdminMenuItem[] = [
  { section: "adminClubDetails", title: "Club Details", subtitle: "View your club information and update its name.", icon: "business-outline", href: "/admin/club-details" },
  { section: "adminSchedules", title: "Schedule", subtitle: "Manage recurring schedules and individual timeslots.", icon: "calendar-outline", href: "/admin/schedule" },
  { section: "adminTables", title: "Tables", subtitle: "Create tables and manage their size and availability.", icon: "grid-outline", href: "/admin/tables" },
  { section: "adminUsers", title: "Users", subtitle: "Manage your club’s users. Coming soon.", icon: "people-outline", href: "/admin/users" },
];
