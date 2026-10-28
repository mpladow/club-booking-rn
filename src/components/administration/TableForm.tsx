// File: src/components/administration/TableForm.tsx
import { router } from "expo-router";
import { useCallback, useState, type ReactElement } from "react";
import { Switch, Text, View } from "react-native";
import { AdminPage, Message } from "./AdminPage";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/Button";
import { administrationService, administrationErrorMessage, validateTable, type ClubDetails, type ClubTable, type TableInput, type TableErrors } from "@/data/administration";
import { today } from "@/data/bookings";
import { useAdministration, useAdministrationFocus, useAdministrationResource, useAdministrationLifetime } from "@/hooks/use-administration";
import { useUnsavedChanges } from "@/hooks/use-confirmation";

interface TableFormData { club: ClubDetails; table: ClubTable | null }
const EMPTY: TableInput = { name: "", size: "", availableFromDate: "", isEnabled: true };
const fields = (table: ClubTable): TableInput => ({ name: table.name, size: table.size, availableFromDate: table.availableFromDate, isEnabled: table.isEnabled });
export const TableForm = ({ tableId }: { tableId?: string }): ReactElement => {
  const isMounted = useAdministrationLifetime();
  const allowed: boolean = useAdministrationFocus("adminTables", true);
  const { clubId, handleFailure, leaving } = useAdministration();
  const load = useCallback(async (): Promise<TableFormData> => {
    const [club, table] = await Promise.all([administrationService.club(clubId ?? ""), tableId === undefined ? Promise.resolve(null) : administrationService.table(clubId ?? "", tableId)]);
    return { club, table };
  }, [clubId, tableId]);
  const resource = useAdministrationResource(load, allowed);
  const [input, setInput] = useState<TableInput>(EMPTY);
  const [baseline, setBaseline] = useState<TableInput | null>(null);
  const [errors, setErrors] = useState<TableErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const dirty: boolean = baseline !== null && JSON.stringify(input) !== JSON.stringify(baseline);
  const [lastResource, setLastResource] = useState<TableFormData | null>(null);
  const { markSaved } = useUnsavedChanges(dirty && !leaving, (): void => { if (baseline) setInput(baseline); }, saving && !leaving);
  if (resource.data && resource.data !== lastResource) {
    setLastResource(resource.data);
    if (!dirty) {
      const initial: TableInput = resource.data.table ? fields(resource.data.table) : { ...EMPTY, availableFromDate: today(resource.data.club.timeZoneId) };
      setInput(initial); setBaseline(initial);
    }
  }
  const change = <K extends keyof TableInput,>(key: K, value: TableInput[K]): void => {
    setInput((current: TableInput): TableInput => ({ ...current, [key]: value }));
    setErrors((current: TableErrors): TableErrors => ({ ...current, [key]: undefined }));
    setError(null);
  };
  const save = async (): Promise<boolean> => {
    const invalid: TableErrors = validateTable(input);
    setErrors(invalid);
    if (Object.keys(invalid).length || !clubId || !allowed) return false;
    setSaving(true); setError(null);
    try {
      await administrationService.saveTable(clubId, input, tableId);
      if (!isMounted()) return false;
      setBaseline(input); markSaved();
      router.dismissTo("/admin/tables");
      return true;
    } catch (failure: unknown) { if (isMounted()) { setError(administrationErrorMessage(failure)); handleFailure(failure); } return false; }
    finally { if (isMounted()) setSaving(false); }
  };
  return <AdminPage title={tableId === undefined ? "Create Table" : "Edit Table"} allowed={allowed} back="/admin/tables"
    loading={resource.loading} error={resource.error} refresh={resource.refresh} refreshing={resource.refreshing}>
    {baseline && <View className="gap-6 rounded-xl border border-neutral-200 bg-white p-5">
      <AuthField label="Table name" value={input.name} onChangeText={(value: string): void => change("name", value)} maxLength={100}
        editable={!saving} error={errors.name} autoCapitalize="words" hint="Names must be unique, including disabled tables." />
      <View className="gap-3"><Text className="text-base font-medium text-neutral-900">Size</Text>
        <View className="flex-row gap-3"><View className="flex-1"><Button disabled={saving} variant={input.size === "small" ? "toggle-active" : "toggle-inactive"} onPress={(): void => change("size", "small")}>Small</Button></View>
          <View className="flex-1"><Button disabled={saving} variant={input.size === "large" ? "toggle-active" : "toggle-inactive"} onPress={(): void => change("size", "large")}>Large</Button></View></View>
        {errors.size && <Text accessibilityRole="alert" className="text-sm text-red-700">{errors.size}</Text>}
      </View>
      <AuthField label="Available from" value={input.availableFromDate} onChangeText={(value: string): void => change("availableFromDate", value)}
        editable={!saving} error={errors.availableFromDate} placeholder="YYYY-MM-DD" maxLength={10} hint={`Date in ${resource.data?.club.timeZoneId ?? "the club timezone"}. Use YYYY-MM-DD.`} />
      <View className="flex-row items-center justify-between gap-5"><View className="min-w-0 flex-1 gap-1"><Text className="text-base font-medium text-neutral-900">Enabled</Text>
        <Text className="text-sm text-neutral-500">Disabled tables remain listed here and cannot receive new bookings.</Text></View>
        <Switch accessibilityLabel="Table enabled" value={input.isEnabled} disabled={saving} onValueChange={(value: boolean): void => change("isEnabled", value)} />
      </View>
      {error && <Message error>{error}</Message>}
      <Button loading={saving} disabled={tableId !== undefined && !dirty} onPress={save}>{tableId === undefined ? "Create Table" : "Save changes"}</Button>
    </View>}
  </AdminPage>;
};
