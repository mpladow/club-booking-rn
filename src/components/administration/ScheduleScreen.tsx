// File: src/components/administration/ScheduleScreen.tsx
import { router } from "expo-router";
import { useCallback, useState, type ReactElement } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { AdminPage, Message } from "./AdminPage";
import { ScheduleCalendar } from "./ScheduleCalendar";
import { ScheduleModal } from "./ScheduleControls";
import { SurfaceTile } from "@/components/ui/SurfaceTile";
import { Button } from "@/components/ui/Button";
import { administrationService, type ClubDetails } from "@/data/administration";
import { ApiError } from "@/data/api-auth";
import { today, dateLabel } from "@/data/bookings";
import { displayName, editableTimeslot, monthRange, schedulingError, schedulingService, sortSchedules, type ScheduleKind, type TimeslotDetails, type WeeklyScheduleDetails } from "@/data/scheduling";
import { useAdministration, useAdministrationFocus, useAdministrationLifetime, useAdministrationResource } from "@/hooks/use-administration";
import { useConfirmation } from "@/hooks/use-confirmation";
interface CalendarData { club: ClubDetails; month: string; slots: TimeslotDetails[]; schedules: WeeklyScheduleDetails[] }
const ScheduleScreen = (): ReactElement => {
  const allowed: boolean = useAdministrationFocus("adminSchedules");
  const { clubId, access, handleFailure } = useAdministration();
  const mounted = useAdministrationLifetime();
  const { confirm } = useConfirmation();
  const [month, setMonth] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [expired, setExpired] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async (): Promise<CalendarData> => {
    const club: ClubDetails = await administrationService.club(clubId ?? "");
    const current: string = month ?? today(club.timeZoneId).slice(0, 7);
    const range = monthRange(current);
    const [slots, schedules] = await Promise.all([schedulingService.timeslots(club.id, range.from, range.to), schedulingService.list(club.id)]);
    return { club, month: current, slots, schedules };
  }, [clubId, month]);
  const resource = useAdministrationResource(load, allowed, schedulingError);
  const data: CalendarData | null = resource.data;
  const localToday: string = data ? today(data.club.timeZoneId) : "";
  const canEdit: boolean = Boolean(access?.permissions.adminSchedules.edit);
  const canDelete: boolean = Boolean(access?.permissions.adminSchedules.delete);
  const open = (kind: ScheduleKind, id?: string, date?: string): void => {
    if (!allowed || !canEdit || busy) return;
    router.push({ pathname: kind === "single" ? "/admin/schedule/single" : "/admin/schedule/recurring", params: { ...(id ? { id } : {}), ...(date ? { date } : {}) } });
    setSelected(null);
  };
  const remove = async (kind: ScheduleKind, id: string): Promise<boolean> => {
    if (!clubId || !allowed || !canDelete || busy) return false;
    setBusy(true); setError(null);
    try {
      const latest = await schedulingService.details(clubId, kind, id);
      if (!mounted()) return false;
      if ("startsAtUtc" in latest.value && !editableTimeslot(latest.value)) throw new Error("This session is read-only because it has started or is closed.");
      const when: string = "weekday" in latest.value
        ? `Every ${latest.value.weekday}, ${latest.value.scheduleStartDate} through ${latest.value.scheduleEndDate ?? "no end date"}`
        : latest.value.localSessionDate;
      const accepted: boolean = await confirm({ title: `Delete ${displayName(latest.value)}?`, accept: kind === "single" ? "Delete timeslot" : "Delete recurring schedule",
        message: `${when}, ${latest.value.startTime.slice(0, 5)}–${latest.value.endTime.slice(0, 5)} (${latest.value.timeZoneId}). ${kind === "single" ? "This closes this occurrence only." : "This retires the recurring schedule and closes its future, unstarted standard occurrences. Individually edited, closed and past occurrences are preserved."} Pending or confirmed bookings block deletion; bookings will not be cancelled.` });
      if (!accepted || !mounted()) return false;
      await schedulingService.remove(clubId, kind, id, latest.etag);
      if (!mounted()) return false;
      setSelected(null); setNotice(kind === "single" ? "Timeslot deleted." : "Recurring schedule retired.");
      await resource.refresh(); return true;
    } catch (failure: unknown) { if (mounted()) { setError(failure instanceof ApiError && failure.status === 412
      ? "This item changed. Deletion was not applied. Select Delete again to reload and review its latest details before confirming." : schedulingError(failure)); handleFailure(failure); } return false; }
    finally { if (mounted()) setBusy(false); }
  };
  const slots: TimeslotDetails[] = (data?.slots ?? []).filter((slot: TimeslotDetails): boolean => slot.localSessionDate === selected).sort((a: TimeslotDetails, b: TimeslotDetails): number => a.startTime.localeCompare(b.startTime));
  return <AdminPage title="Schedule" back="/admin" allowed={allowed} loading={resource.loading} error={resource.error} refresh={resource.refresh} refreshing={resource.refreshing}>
    {error && <Message error>{error}</Message>}{notice && <Message>{notice}</Message>}
    {data && <>
      <Text className="text-sm text-neutral-500">All dates and times are in {data.club.timeZoneId}.</Text>
      <SurfaceTile title="Calendar" action={canEdit && <Button disabled={busy} onPress={(): void => open("single")}>Create Single Timeslot</Button>}>
        <ScheduleCalendar month={data.month} today={localToday} timeslots={data.slots} changeMonth={(next: string): void => { setMonth(next); setSelected(null); }} busy={busy || resource.refreshing} canCreate={canEdit}
          selectDate={(date: string): void => { if (data.slots.some((slot: TimeslotDetails): boolean => slot.localSessionDate === date)) setSelected(date); else open("single", undefined, date); }} />
      </SurfaceTile>
      <SurfaceTile title="Recurring timeslots" action={canEdit && <Button disabled={busy} onPress={(): void => open("recurring")}>Create Recurring Timeslot</Button>}>
        <View className="flex-row items-center justify-between gap-3"><Text className="text-base text-neutral-900">Show expired schedules</Text><Switch accessibilityLabel="Show expired schedules" value={expired} onValueChange={setExpired} /></View>
        {sortSchedules(data.schedules, localToday, expired).length === 0 && <Text className="text-sm text-neutral-500">No recurring schedules to display.</Text>}
        {sortSchedules(data.schedules, localToday, expired).map((schedule: WeeklyScheduleDetails): ReactElement => <View key={schedule.id} className="gap-3 rounded-xl border border-neutral-200 p-4">
          <Text className="text-base font-semibold text-neutral-900">{displayName(schedule)}</Text>
          <Text className="text-base text-neutral-900">{schedule.weekday} · {schedule.startTime.slice(0, 5)}–{schedule.endTime.slice(0, 5)}</Text>
          <Text className="text-sm text-neutral-500">{schedule.scheduleStartDate} → {schedule.scheduleEndDate ?? "No end date"}{schedule.scheduleEndDate && schedule.scheduleEndDate < localToday ? " · Expired" : ""}</Text>
          {schedule.description && <Text className="text-sm text-neutral-500">{schedule.description}</Text>}
          <View className="flex-row flex-wrap gap-2">{canEdit && <Button disabled={busy} variant="outlined" onPress={(): void => open("recurring", schedule.id)}>Edit Recurring Timeslot</Button>}
            {canDelete && <Button disabled={busy} variant="text" onPress={(): Promise<boolean> => remove("recurring", schedule.id)}>Delete</Button>}</View>
        </View>)}
      </SurfaceTile>
      <ScheduleModal title={selected ? dateLabel(selected) : "Timeslots"} visible={selected !== null} close={(): void => { if (!busy) setSelected(null); }}>
        <ScrollView keyboardShouldPersistTaps="handled"><View className="gap-4 pb-4">
          {error && <Message error>{error}</Message>}
          {slots.map((slot: TimeslotDetails): ReactElement => <View key={slot.id} className="gap-3 rounded-xl border border-neutral-200 p-4">
            <Text className="text-lg font-semibold text-neutral-900">{displayName(slot)}</Text>
            <Text className="text-base text-neutral-900">{slot.startTime.slice(0, 5)}–{slot.endTime.slice(0, 5)}</Text>
            <Text className="text-sm text-neutral-500">{slot.occurrenceType === "Customised" ? "Individually edited occurrence" : slot.occurrenceType === "Recurring" ? "Recurring occurrence" : "One-off session"}</Text>
            {slot.description && <Text className="text-sm text-neutral-500">{slot.description}</Text>}
            {!editableTimeslot(slot) ? <Text className="text-sm text-neutral-500">Read-only · Started, completed or closed</Text> : <View className="flex-row flex-wrap gap-2">
              {canEdit && <Button disabled={busy} variant="outlined" onPress={(): void => open("single", slot.id)}>Edit occurrence</Button>}
              {canDelete && <Button disabled={busy} variant="text" onPress={(): Promise<boolean> => remove("single", slot.id)}>Delete occurrence</Button>}
            </View>}
          </View>)}
        </View></ScrollView>
      </ScheduleModal>
    </>}
  </AdminPage>;
};
export default ScheduleScreen;
