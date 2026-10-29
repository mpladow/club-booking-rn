// File: src/components/administration/ScheduleForm.tsx
import { router, Stack } from "expo-router";
import { type ReactElement } from "react";
import { Text, TextInput, View } from "react-native";
import { AdminPage, Message } from "./AdminPage";
import { DateField, SelectField } from "./ScheduleControls";
import { SurfaceTile } from "@/components/ui/SurfaceTile";
import { AuthField } from "@/components/auth/AuthField";
import { Button } from "@/components/ui/Button";
import { today } from "@/data/bookings";
import { displayName, savedDraft, TIME_OPTIONS, WEEKDAYS, type ScheduleDraft, type ScheduleKind, type Weekday } from "@/data/scheduling";
import { useAdministrationFocus } from "@/hooks/use-administration";
import { useScheduleEditor } from "@/hooks/use-schedule-editor";
const Summary = ({ input, kind, title }: { input: ScheduleDraft; kind: ScheduleKind; title: string }): ReactElement => <SurfaceTile title={title}>
  <Text className="text-base font-semibold text-neutral-900">{input.name.trim() || (kind === "recurring" ? "Regular Session" : "Additional Session")}</Text>
  {input.description.trim() && <Text className="text-base text-neutral-900">{input.description.trim()}</Text>}
  <Text className="text-base text-neutral-900">{kind === "recurring" ? `Every ${input.weekday}` : input.localSessionDate} · {input.startTime.slice(0, 5)}–{input.endTime.slice(0, 5)}</Text>
  {kind === "recurring" && <><Text className="text-sm text-neutral-500">Apply changes from: {input.scheduleStartDate}</Text><Text className="text-sm text-neutral-500">End of Schedule: {input.scheduleEndDate || "No end date"} (inclusive)</Text></>}
</SurfaceTile>;
export const ScheduleForm = ({ kind, id, date }: { kind: ScheduleKind; id?: string; date?: string }): ReactElement => {
  const allowed: boolean = useAdministrationFocus("adminSchedules", true);
  const editor = useScheduleEditor(kind, allowed, id, date);
  const { input, errors } = editor;
  const recurring: boolean = kind === "recurring";
  const zone: string = editor.data?.club.timeZoneId ?? "the club timezone";
  const minimum: string = editor.data ? [today(zone), editor.data.club.commencementDate].sort().at(-1) ?? today(zone) : "2000-01-01";
  const disabled: boolean = editor.saving || editor.readOnly || editor.stale;
  const fallback: string = editor.current ? displayName({ ...editor.current.value, name: null }) : recurring ? "Regular Session" : "Additional Session";
  const heading: string = editor.stage === "saved" ? "Saved" : editor.stage === "review" ? "Review Timeslot" : `${editor.current ? "Edit" : "Create"} ${recurring ? "Recurring" : "Single"} Timeslot`;
  return <AdminPage title={heading} allowed={allowed} back="/admin/schedule" loading={editor.loading} error={editor.loadError} refresh={editor.refresh} refreshing={editor.refreshing}>
    <Stack.Screen options={{ title: heading }} />
    {editor.initialized && <>
      <Text className="text-sm text-neutral-500">All dates and times are in {zone}.</Text>
      {editor.error && <Message error>{editor.error}</Message>}
      {editor.stale && <View className="gap-4">
        <Message error>Your draft is preserved. Reload and compare the latest details before deciding how to continue.</Message>
        {!editor.latest ? <Button loading={editor.saving} onPress={editor.reloadLatest}>Reload latest details</Button> : <>
          <Summary input={savedDraft(editor.latest.value)} kind={kind} title="Latest saved details" />
          <Button disabled={editor.saving || editor.readOnly} onPress={(): void => editor.reconcile(true)}>Keep my draft against this version</Button>
          <Button disabled={editor.saving} variant="outlined" onPress={(): void => editor.reconcile(false)}>Use latest details instead</Button>
        </>}
      </View>}
      {editor.readOnly && <Message>This session has started, completed or closed and is entirely read-only.</Message>}
      {editor.stage === "form" ? <SurfaceTile title="Timeslot details">
        <AuthField label="Title (optional)" value={input.name} editable={!disabled} placeholder={fallback}
          onChangeText={(value: string): void => editor.change("name", value)} autoCapitalize="sentences" />
        <View className="gap-2"><Text nativeID="schedule-description" className="text-base font-medium text-neutral-900">Description (optional)</Text>
          <TextInput accessibilityLabel="Description (optional)" accessibilityLabelledBy="schedule-description" multiline editable={!disabled} value={input.description} onChangeText={(value: string): void => editor.change("description", value)}
            className={`min-h-28 rounded-xl border border-neutral-200 bg-white p-4 text-base text-neutral-900 focus:border-indigo-600 focus:ring-1 focus:ring-indigo-600 ${disabled ? "opacity-50" : ""}`} />
        </View>
        {recurring ? <><SelectField label="Weekday" value={input.weekday} options={WEEKDAYS} disabled={disabled} error={errors.weekday} change={(value: string): void => editor.change("weekday", value as Weekday)} />
          <DateField label="Apply changes from" value={input.scheduleStartDate} minimum={minimum} disabled={disabled} error={errors.scheduleStartDate} change={(value: string): void => editor.change("scheduleStartDate", value)} />
          <DateField label="End of Schedule date (optional, inclusive)" value={input.scheduleEndDate} minimum={input.scheduleStartDate > minimum ? input.scheduleStartDate : minimum} optional disabled={disabled} error={errors.scheduleEndDate} change={(value: string): void => editor.change("scheduleEndDate", value)} />
          <Message>Repeats weekly on the selected weekday, starting with the first matching day on or after Apply changes from. For a permanent recurring change, end-date the existing schedule and create a new one. Past and individually edited occurrences are preserved.</Message>
        </> : <><DateField label="Session date" value={input.localSessionDate} minimum={minimum} disabled={disabled || editor.dateFixed} error={errors.localSessionDate} change={(value: string): void => editor.change("localSessionDate", value)} />
          {editor.dateFixed && <Text className="text-sm text-neutral-500">This edit affects only this occurrence. Its recurring date is fixed.</Text>}</>}
        <View className="gap-5 sm:flex-row"><View className="flex-1"><SelectField label="Start time" value={input.startTime} options={TIME_OPTIONS} disabled={disabled} error={errors.startTime} change={(value: string): void => editor.change("startTime", value)} /></View>
          <View className="flex-1"><SelectField label="End time" value={input.endTime} options={TIME_OPTIONS} disabled={disabled} error={errors.endTime} change={(value: string): void => editor.change("endTime", value)} /></View></View>
        <Button disabled={disabled} onPress={editor.review}>Save</Button>
      </SurfaceTile> : editor.stage === "review" ? <>
        <Summary input={{ ...input, name: input.name.trim() || fallback }} kind={kind} title="Review your changes" />
        <Message>{editor.current ? "Confirm applies these changes." : "Confirm creates this timeslot."} Changes to a recurring schedule affect future standard occurrences only. Pending or confirmed bookings and overlaps can prevent saving. Bookings will not be cancelled.</Message>
        <Button loading={editor.saving} disabled={disabled} onPress={editor.confirm}>Confirm</Button>
        <Button variant="outlined" disabled={editor.saving} onPress={editor.backToForm}>Back to form</Button>
      </> : <>
        <Message>Your changes have been saved.</Message>
        <Summary input={editor.current ? savedDraft(editor.current.value) : input} kind={kind} title="Saved details" />
        <Button onPress={(): void => router.dismissTo("/admin/schedule")}>Back to Schedule</Button>
        <Button variant="outlined" disabled={editor.readOnly} onPress={editor.editSaved}>Edit</Button>
      </>}
    </>}
  </AdminPage>;
};
