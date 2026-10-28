// File: src/app/(tabs)/admin/club-details.tsx
import { useCallback, useState, type ReactElement } from "react";
import { Text, View } from "react-native";
import { AdminPage, Message } from "@/components/administration/AdminPage";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/Button";
import { administrationService, administrationErrorMessage, nameError, type ClubDetails } from "@/data/administration";
import { dateLabel } from "@/data/bookings";
import { useAdministration, useAdministrationFocus, useAdministrationResource, useAdministrationLifetime } from "@/hooks/use-administration";
import { useUnsavedChanges } from "@/hooks/use-confirmation";

const Detail = ({ label, value }: { label: string; value: string }): ReactElement => <View className="gap-1">
  <Text className="text-sm text-neutral-500">{label}</Text><Text selectable className="text-base text-neutral-900">{value}</Text>
</View>;
const ClubDetailsScreen = (): ReactElement => {
  const isMounted = useAdministrationLifetime();
  const allowed: boolean = useAdministrationFocus("adminClubDetails");
  const { clubId, access, handleFailure, leaving } = useAdministration();
  const load = useCallback((): Promise<ClubDetails> => administrationService.club(clubId ?? ""), [clubId]);
  const resource = useAdministrationResource(load, allowed);
  const [baseline, setBaseline] = useState<ClubDetails | null>(null);
  const [name, setName] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [success, setSuccess] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const canEdit: boolean = allowed && Boolean(access?.permissions.adminClubDetails.edit);
  const dirty: boolean = baseline !== null && name !== baseline.name;
  const [lastResource, setLastResource] = useState<ClubDetails | null>(null);
  const { markSaved } = useUnsavedChanges(dirty && !leaving, (): void => setName(baseline?.name ?? ""), saving && !leaving);
  if (resource.data && resource.data !== lastResource) {
      setLastResource(resource.data);
      if (!dirty) { setBaseline(resource.data); setName(resource.data.name); }
  }
  const save = async (): Promise<boolean> => {
    const invalid: string | undefined = nameError(name, 200);
    setFieldError(invalid);
    if (invalid || !clubId || !canEdit) return false;
    setSaving(true); setError(null); setSuccess(false);
    try {
      const updated: ClubDetails = await administrationService.renameClub(clubId, name);
      if (!isMounted()) return false;
      setBaseline(updated); setName(updated.name); markSaved(); setSuccess(true);
      return true;
    } catch (failure: unknown) { if (isMounted()) { setError(administrationErrorMessage(failure)); handleFailure(failure); } return false; }
    finally { if (isMounted()) setSaving(false); }
  };
  const details: ClubDetails | null = baseline ?? resource.data;
  return <AdminPage title="Club Details" allowed={allowed} back="/admin" loading={resource.loading} error={resource.error} refresh={resource.refresh} refreshing={resource.refreshing}>
    {details && <View className="gap-6 rounded-xl border border-neutral-200 bg-white p-5">
      <AuthField label="Club name" value={name} maxLength={200} editable={canEdit && !saving} error={fieldError} autoCapitalize="words"
        onChangeText={(value: string): void => { setName(value); setFieldError(undefined); setSuccess(false); setError(null); }} />
      <Detail label="Timezone" value={details.timeZoneId} />
      <Detail label="Commencement date" value={dateLabel(details.commencementDate)} />
      <Detail label="Booking window" value={`${details.bookingWindowDays} days`} />
      <Detail label="Your role" value={details.role} />
      <Detail label="Paid membership" value={details.isPaidMember ? "Yes" : "No"} />
      <Detail label="Club ID" value={details.id} />
      {error && <Message error>{error}</Message>}
      {success && <Message>Club details saved.</Message>}
      {canEdit && <Button loading={saving} disabled={!dirty} onPress={save}>Save changes</Button>}
    </View>}
  </AdminPage>;
};
export default ClubDetailsScreen;
