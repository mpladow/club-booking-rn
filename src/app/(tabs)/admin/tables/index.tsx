// File: src/app/(tabs)/admin/tables/index.tsx
import { router } from "expo-router";
import { useCallback, useState, type ReactElement } from "react";
import { Text, View } from "react-native";
import { AdminPage, Message } from "@/components/administration/AdminPage";
import { Button } from "@/components/ui/Button";
import { administrationService, administrationErrorMessage, type ClubTable } from "@/data/administration";
import { dateLabel } from "@/data/bookings";
import { useAdministration, useAdministrationFocus, useAdministrationResource, useAdministrationLifetime } from "@/hooks/use-administration";
import { useConfirmation } from "@/hooks/use-confirmation";

const TablesScreen = (): ReactElement => {
  const isMounted = useAdministrationLifetime();
  const allowed: boolean = useAdministrationFocus("adminTables");
  const { clubId, access, handleFailure } = useAdministration();
  const load = useCallback((): Promise<ClubTable[]> => administrationService.tables(clubId ?? ""), [clubId]);
  const resource = useAdministrationResource(load, allowed);
  const { confirm } = useConfirmation();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const permissions = access?.permissions.adminTables;
  const remove = async (table: ClubTable): Promise<boolean> => {
    if (!clubId || !permissions?.delete || removing) return false;
    if (!await confirm({ title: "Remove Table?", message: `Remove “${table.name}”? Booking history will be preserved. The table will no longer be available and cannot be restored.`, accept: "Remove Table" }) || !isMounted()) return false;
    setRemoving(table.id); setError(null); setSuccess(null);
    try {
      await administrationService.removeTable(clubId, table.id);
      if (!isMounted()) return false;
      setSuccess(`${table.name} removed. Booking history has been preserved.`);
      await resource.refresh();
      return true;
    } catch (failure: unknown) { if (isMounted()) { setError(administrationErrorMessage(failure)); handleFailure(failure); } return false; }
    finally { if (isMounted()) setRemoving(null); }
  };
  return <AdminPage title="Tables" allowed={allowed} back="/admin" loading={resource.loading} error={resource.error} refresh={resource.refresh} refreshing={resource.refreshing}>
    {permissions?.edit && <Button onPress={(): void => router.push("/admin/tables/create")}>Create Table</Button>}
    {error && <Message error>{error}</Message>}
    {success && <Message>{success}</Message>}
    {resource.data?.length === 0 && <View className="gap-2 rounded-xl border border-neutral-200 bg-white p-6">
      <Text className="text-lg font-semibold text-neutral-900">No tables yet</Text><Text className="text-sm text-neutral-500">Tables will appear here when they are created.</Text>
    </View>}
    {resource.data?.map((table: ClubTable): ReactElement => <View key={table.id} className="gap-4 rounded-xl border border-neutral-200 bg-white p-5">
      <View className="flex-row items-center justify-between gap-3"><Text className="min-w-0 flex-1 text-lg font-semibold text-neutral-900">{table.name}</Text>
        <Text className={`rounded-full px-3 py-1 text-sm ${table.isEnabled ? "bg-indigo-50 text-indigo-700" : "bg-neutral-100 text-neutral-600"}`}>{table.isEnabled ? "Enabled" : "Disabled"}</Text></View>
      <Text className="text-base text-neutral-900">{table.size === "small" ? "Small" : "Large"}</Text>
      <Text className="text-sm text-neutral-500">Available from {dateLabel(table.availableFromDate)}</Text>
      {(permissions?.edit || permissions?.delete) && <View className="flex-row flex-wrap gap-3">
        {permissions.edit && <Button variant="outlined" disabled={Boolean(removing)} onPress={(): void => router.push({ pathname: "/admin/tables/[tableId]", params: { tableId: table.id } })}>Edit Table</Button>}
        {permissions.delete && <Button variant="text" loading={removing === table.id} disabled={Boolean(removing)} onPress={(): Promise<boolean> => remove(table)}>Remove Table</Button>}
      </View>}
    </View>)}
  </AdminPage>;
};
export default TablesScreen;
