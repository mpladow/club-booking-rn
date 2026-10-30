// File: src/data/schedule-tables.ts
import { type ClubTable } from "./administration";
import { validTableIds } from "./scheduling";
export interface AssignmentRow { id: string; table: ClubTable | null; section: "active" | "disabled" | "missing" }
export const toggleTable = (ids: readonly string[], id: string): string[] => ids.includes(id) ? ids.filter((value: string): boolean => value !== id) : [...ids, id].sort();
export const assignmentRows = (tables: readonly ClubTable[], retained: readonly string[]): AssignmentRow[] => {
  const sort = (a: ClubTable, b: ClubTable): number => a.name.localeCompare(b.name, "en", { numeric: true });
  return [
    ...tables.filter((table: ClubTable): boolean => table.isEnabled).sort(sort).map((table: ClubTable): AssignmentRow => ({ id: table.id, table, section: "active" })),
    ...tables.filter((table: ClubTable): boolean => !table.isEnabled && retained.includes(table.id)).sort(sort).map((table: ClubTable): AssignmentRow => ({ id: table.id, table, section: "disabled" })),
    ...retained.filter((id: string): boolean => !tables.some((table: ClubTable): boolean => table.id === id)).map((id: string): AssignmentRow => ({ id, table: null, section: "missing" })),
  ];
};
// Disabled assignments are round-tripped only if this occurrence/rule already held them.
// A refreshed catalogue must never silently prune draft selections.
export const tableSelectionError = (selected: string[] | null, tables: readonly ClubTable[], retained: readonly string[], canInherit: boolean): string | undefined => {
  if (selected === null) return canInherit ? undefined : "Choose an explicit table selection. Zero tables is allowed.";
  if (!validTableIds(selected)) return "Choose a valid table selection.";
  for (const id of selected) {
    const table: ClubTable | undefined = tables.find((item: ClubTable): boolean => item.id === id);
    if (!table) return "A selected table is no longer available. Open Configure Tables and remove it from your selection.";
    if (!table.isEnabled && !retained.includes(id)) return "A newly selected table is now disabled. Remove it from your selection or refresh the table list.";
  }
  return undefined;
};
