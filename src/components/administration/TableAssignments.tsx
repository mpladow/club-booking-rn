// File: src/components/administration/TableAssignments.tsx
import { useState, type ReactElement } from "react";
import { FlatList, Pressable, Switch, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { type ClubTable } from "@/data/administration";
import { assignmentRows, tableSelectionError, toggleTable, type AssignmentRow } from "@/data/schedule-tables";
import { Button } from "@/components/ui/Button";
import { Message } from "./AdminPage";
import { ScheduleModal } from "./ScheduleControls";
export const TableAssignmentsSummary = ({ ids, inherited, tables }: { ids: readonly string[] | null; inherited: boolean; tables: readonly ClubTable[] }): ReactElement => (
  <View className="gap-2">
    <Text className="text-base font-medium text-neutral-900">{inherited ? "Tables · Uses recurring schedule tables" : `Tables${ids ? ` · ${ids.length} selected` : ""}`}</Text>
    {ids === null ? <Text className="text-sm text-neutral-500">The recurring selection will be resolved when saved.</Text> : ids.length === 0 ? <Text className="text-sm text-neutral-500">No tables assigned. No tables will be available for booking.</Text>
      : ids.map((id: string): ReactElement => {
        const table: ClubTable | undefined = tables.find((item: ClubTable): boolean => item.id === id);
        return <View key={id} className="gap-1 border-l-2 border-neutral-200 pl-3"><Text className="text-sm font-medium text-neutral-900">{table?.name ?? "Table no longer available"}{table ? ` · ${table.size === "small" ? "Small" : "Large"}${table.isEnabled ? "" : " · Disabled"}` : ""}</Text>
          {table && <Text className="text-sm text-neutral-500">Available from {table.availableFromDate}</Text>}</View>;
      })}
  </View>
);
interface PickerProps {
  value: string[] | null; inheritedIds: readonly string[] | null; tables: readonly ClubTable[];
  retainedIds: readonly string[]; canInherit: boolean; disabled: boolean;
  apply: (ids: string[] | null) => void; close: () => void; refresh: () => Promise<void>; refreshing: boolean;
}
// Mounted only while open. Every visit starts from the confirmed form value; Cancel
// and the modal's native Back action discard this isolated provisional selection.
export const TableAssignmentPicker = ({ value, inheritedIds, tables, retainedIds, canInherit, disabled, apply, close, refresh, refreshing }: PickerProps): ReactElement => {
  const [inherit, setInherit] = useState<boolean>(value === null);
  const [customIds, setCustomIds] = useState<string[]>((): string[] => [...(value ?? inheritedIds ?? [])]);
  const [error, setError] = useState<string | null>(null);
  const selected: readonly string[] = inherit ? inheritedIds ?? [] : customIds;
  // Keep disabled/unavailable selections visible even after they are deselected.
  const rows: AssignmentRow[] = assignmentRows(tables, [...new Set([...retainedIds, ...customIds, ...(inherit ? inheritedIds ?? [] : [])])]);
  const unavailable: boolean = disabled || refreshing;
  const confirm = (): boolean => {
    const next: string[] | null = inherit ? null : customIds;
    const invalid: string | undefined = tableSelectionError(next, tables, retainedIds, canInherit);
    if (invalid) { setError(invalid); return false; }
    apply(next === null ? null : [...next]); close(); return true;
  };
  return <ScheduleModal title="Configure Tables" visible close={close}>
    <FlatList className="min-h-0 shrink" data={rows} extraData={`${inherit}:${selected.join(",")}:${unavailable}`} keyExtractor={(row: AssignmentRow): string => row.id} initialNumToRender={12}
      refreshing={refreshing} onRefresh={refresh} keyboardShouldPersistTaps="handled"
      ListHeaderComponent={<View className="gap-3 pb-3">
        {canInherit && <View className="flex-row items-center justify-between gap-3"><Text className="min-w-0 flex-1 text-base font-medium text-neutral-900">Use recurring schedule tables</Text>
          <Switch accessibilityLabel="Use recurring schedule tables" value={inherit} disabled={unavailable} onValueChange={(next: boolean): void => { setInherit(next); setError(null); }} /></View>}
        <Text className="text-sm text-neutral-500">{inherit ? "Turn off inheritance to configure tables for only this occurrence." : `${customIds.length} selected. Tap a table to select or unselect it. Zero tables is allowed.`}</Text>
        {inherit && inheritedIds === null && <Message>The recurring selection cannot be previewed. It will be resolved when saved.</Message>}
        {error && <Message error>{error}</Message>}
      </View>}
      ListFooterComponent={<Button variant="text" disabled={unavailable} onPress={refresh}>Refresh tables</Button>}
      ListEmptyComponent={<Text className="p-4 text-sm text-neutral-500">No active tables. You can confirm an empty selection.</Text>}
      renderItem={({ item, index }: { item: AssignmentRow; index: number }): ReactElement => {
        const checked: boolean = selected.includes(item.id);
        const rowDisabled: boolean = unavailable || inherit || ((!item.table || !item.table.isEnabled && !retainedIds.includes(item.id)) && !checked);
        return <View className="gap-2 pb-2">
          {item.section !== rows[index - 1]?.section && <Text className="pt-2 text-sm font-medium text-neutral-500">{item.section === "active" ? "Active tables" : item.section === "disabled" ? "Assigned but disabled" : "Unavailable assignments"}</Text>}
          <Pressable accessibilityRole="checkbox" accessibilityLabel={item.table ? `${item.table.name}, ${item.table.size}, available from ${item.table.availableFromDate}${item.section === "disabled" ? ", disabled table" : ""}` : "Unavailable table"} accessibilityState={{ checked, disabled: rowDisabled }} disabled={rowDisabled}
            onPress={(): void => { setCustomIds((ids: string[]): string[] => toggleTable(ids, item.id)); setError(null); }}
            className={`min-h-16 flex-row items-center gap-3 rounded-xl border p-3 active:opacity-75 focus-visible:ring-2 focus-visible:ring-indigo-600 ${checked ? "border-indigo-200 bg-indigo-50" : "border-neutral-200 bg-white"} ${rowDisabled ? "opacity-60" : ""}`}>
            <Ionicons name={checked ? "checkbox" : "square-outline"} size={24} color={checked ? "#4f46e5" : "#737373"} />
            <View className="min-w-0 flex-1 gap-1"><Text className="text-base font-medium text-neutral-900">{item.table?.name ?? "Table no longer available"}</Text>
              <Text className="text-sm text-neutral-500">{item.table ? `${item.table.size === "small" ? "Small" : "Large"} · Available from ${item.table.availableFromDate}` : "Unselect this table before confirming."}</Text>
            </View>
          </Pressable>
        </View>;
      }} />
    <View className="gap-3"><Button disabled={unavailable} onPress={confirm}>Confirm</Button>
      <Button variant="outlined" onPress={close}>Cancel</Button></View>
  </ScheduleModal>;
};
