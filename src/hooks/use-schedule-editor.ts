// File: src/hooks/use-schedule-editor.ts
import { useCallback, useEffect, useState } from "react";
import { administrationService, validDate, type ClubDetails, type ClubTable } from "@/data/administration";
import { ApiError } from "@/data/api-auth";
import { today } from "@/data/bookings";
import { draftFrom, editableTimeslot, emptyDraft, localClock, schedulingError, schedulingService, validateSchedule, type ScheduleDetails, type ScheduleDraft, type ScheduleErrors, type ScheduleKind, type Versioned } from "@/data/scheduling";
import { useAdministration, useAdministrationLifetime, useAdministrationResource } from "./use-administration";
import { useUnsavedChanges } from "./use-confirmation";
import { tableSelectionError } from "@/data/schedule-tables";
interface EditorData { club: ClubDetails; item: Versioned<ScheduleDetails> | null; tables: ClubTable[]; parentTableIds: string[] | null }
const loadEditor = async (clubId: string, kind: ScheduleKind, id?: string): Promise<EditorData> => {
  const [club, item, tables] = await Promise.all([administrationService.club(clubId), id === undefined ? Promise.resolve(null) : schedulingService.details(clubId, kind, id), administrationService.tables(clubId)]);
  let parentTableIds: string[] | null = null;
  if (item && "recurringScheduleId" in item.value && item.value.recurringScheduleId) {
    try { const parent = await schedulingService.details(clubId, "recurring", item.value.recurringScheduleId); if ("weekday" in parent.value) parentTableIds = parent.value.tableIds; }
    catch (error: unknown) { if (!(error instanceof ApiError) || error.status !== 404) throw error; }
    // Retired rules cannot be fetched but the API can still restore inheritance.
  }
  return { club, item, tables, parentTableIds };
};
type Stage = "form" | "review" | "saved";
export interface ScheduleEditor {
  input: ScheduleDraft; errors: ScheduleErrors; error: string | null; saving: boolean; stage: Stage;
  data: EditorData | null; initialized: boolean; readOnly: boolean; dateFixed: boolean;
  loading: boolean; loadError: string | null; refreshing: boolean; refresh: () => Promise<void>;
  stale: boolean; latest: Versioned<ScheduleDetails> | null; current: Versioned<ScheduleDetails> | null;
  inheritedTableIds: readonly string[] | null; retainedTableIds: readonly string[];
  configuringTables: boolean; openTables: () => void; closeTables: () => void;
  change: <K extends keyof ScheduleDraft>(key: K, value: ScheduleDraft[K]) => void;
  review: () => boolean; confirm: () => Promise<boolean>; backToForm: () => void; editSaved: () => void;
  reloadLatest: () => Promise<void>; reconcile: (keepDraft: boolean) => void;
}
export const useScheduleEditor = (kind: ScheduleKind, allowed: boolean, id?: string, date?: string): ScheduleEditor => {
  const { clubId, handleFailure, leaving } = useAdministration();
  const mounted = useAdministrationLifetime();
  const load = useCallback((): Promise<EditorData> => loadEditor(clubId ?? "", kind, id), [clubId, id, kind]);
  const resource = useAdministrationResource(load, allowed, schedulingError);
  const [input, setInput] = useState<ScheduleDraft>(() => emptyDraft("2000-01-01"));
  const [baseline, setBaseline] = useState<ScheduleDraft | null>(null);
  const [current, setCurrent] = useState<Versioned<ScheduleDetails> | null>(null);
  const [stage, setStage] = useState<Stage>("form");
  const [errors, setErrors] = useState<ScheduleErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<boolean>(false);
  const [stale, setStale] = useState<boolean>(false);
  const [latest, setLatest] = useState<Versioned<ScheduleDetails> | null>(null);
  const [latestData, setLatestData] = useState<EditorData | null>(null);
  const [configuringTables, setConfiguringTables] = useState<boolean>(false);
  const closeTables = (): void => setConfiguringTables(false);
  const [clock, setClock] = useState<number>(Date.now);
  useEffect((): (() => void) => { const timer: ReturnType<typeof setInterval> = setInterval((): void => setClock(Date.now()), 15000); return (): void => clearInterval(timer); }, []);
  const dirty: boolean = baseline !== null && (stage === "review" || JSON.stringify(input) !== JSON.stringify(baseline));
  const [lastResource, setLastResource] = useState<EditorData | null>(null);
  const { markSaved } = useUnsavedChanges(dirty && stage !== "saved" && !leaving, (): void => { if (baseline) setInput(baseline); setStage("form"); }, saving && !leaving, configuringTables && !leaving ? closeTables : undefined);
  // Refresh may update the club metadata, but an in-progress draft retains its original ETag.
  if (resource.data && resource.data !== lastResource) {
    setLastResource(resource.data);
    setLatestData(null);
    if (!baseline) {
      const localToday: string = today(resource.data.club.timeZoneId);
      const initial: ScheduleDraft = resource.data.item ? draftFrom(resource.data.item.value, localToday) : emptyDraft(validDate(date) ? date : localToday);
      setInput(initial); setBaseline(initial); setCurrent(resource.data.item);
    }
  }
  const value: ScheduleDetails | undefined = (latest ?? current)?.value;
  const data: EditorData | null = latestData ?? resource.data;
  const readOnly: boolean = Boolean(value && "startsAtUtc" in value && !editableTimeslot(value, clock));
  const dateFixed: boolean = Boolean(value && "recurringScheduleId" in value && value.recurringScheduleId);
  const retainedTableIds: readonly string[] = value ? "effectiveTableIds" in value ? value.effectiveTableIds : value.tableIds : [];
  const inheritedTableIds: readonly string[] | null = data?.parentTableIds ?? (value && "effectiveTableIds" in value && value.tableIds === null ? value.effectiveTableIds : null);
  const change = <K extends keyof ScheduleDraft,>(key: K, value: ScheduleDraft[K]): void => {
    if (saving || readOnly || stale) return;
    setInput((previous: ScheduleDraft): ScheduleDraft => ({ ...previous, [key]: value }));
    setErrors((previous: ScheduleErrors): ScheduleErrors => ({ ...previous, [key]: undefined })); setError(null);
  };
  const validate = (): boolean => {
    if (!data || !allowed || readOnly || stale || configuringTables) return false;
    const zone: string = data.club.timeZoneId;
    const invalid: ScheduleErrors = validateSchedule(input, kind, today(zone), localClock(zone), data.club.commencementDate);
    const tableError: string | undefined = tableSelectionError(input.tableIds, data.tables, retainedTableIds, dateFixed);
    if (tableError) invalid.tableIds = tableError;
    // Temporary protection for the verified API PropagateTables cutoff gap in #16.
    // Remove after scheduleStartDate bounds inherited table propagation on the server.
    const existingTables: string[] | null = current && "weekday" in current.value ? current.value.tableIds : null;
    const selectedTables: string[] | null = input.tableIds;
    if (existingTables && selectedTables && input.scheduleStartDate > today(zone)
      && (selectedTables.length !== existingTables.length || selectedTables.some((id: string): boolean => !existingTables.includes(id))))
      invalid.tableIds = "Table changes to an existing recurring schedule can currently start only today. Choose today's date or keep the existing table selection.";
    setErrors(invalid);
    return Object.keys(invalid).length === 0;
  };
  const review = (): boolean => { if (!validate()) return false; setError(null); setStage("review"); return false; };
  const submit = async (): Promise<boolean> => {
    if (stage !== "review" || saving || !clubId || !validate()) { if (stage === "review" && !stale) setStage("form"); return false; }
    setSaving(true); setError(null);
    try {
      const saved: Versioned<ScheduleDetails> = await schedulingService.save(clubId, kind, input, current ? { id: current.value.id, etag: current.etag } : undefined);
      if (!mounted()) return false;
      setCurrent(saved); setBaseline(input); setStage("saved"); markSaved(); return true;
    } catch (failure: unknown) {
      if (mounted()) {
        setError(schedulingError(failure)); handleFailure(failure);
        if (failure instanceof ApiError && failure.status === 412) { setStale(true); setLatest(null); }
        if (failure instanceof ApiError && ["TimeslotAlreadyStarted", "TimeslotClosed"].includes(failure.serverCode ?? "")) { setStale(true); setLatest(null); }
      }
      return false;
    } finally { if (mounted()) setSaving(false); }
  };
  const reloadLatest = async (): Promise<void> => {
    if (!clubId || !current || saving) return;
    setSaving(true);
    try {
      const loaded: EditorData = await loadEditor(clubId, kind, current.value.id);
      if (mounted()) { setLatest(loaded.item); setLatestData(loaded); setError(null); }
    } catch (failure: unknown) { if (mounted()) { setError(schedulingError(failure)); handleFailure(failure); } }
    finally { if (mounted()) setSaving(false); }
  };
  const reconcile = (keepDraft: boolean): void => {
    if (!latest || !data || saving) return;
    const fresh: ScheduleDraft = draftFrom(latest.value, today(data.club.timeZoneId));
    setCurrent(latest); setBaseline(fresh); if (!keepDraft) setInput(fresh);
    setLatest(null); setStale(false); setStage("form"); setErrors({}); setError(null);
  };
  return { input, errors, error, saving, stage, data, initialized: baseline !== null, readOnly, dateFixed, current, inheritedTableIds, retainedTableIds, configuringTables, closeTables,
    openTables: (): void => { if (stage === "form" && allowed && !saving && !readOnly && !stale) setConfiguringTables(true); },
    loading: resource.loading, loadError: resource.error, refreshing: resource.refreshing, refresh: resource.refresh,
    stale, latest, change, review, confirm: submit, backToForm: (): void => setStage("form"),
    editSaved: (): void => { if (current && data) { const fresh: ScheduleDraft = draftFrom(current.value, today(data.club.timeZoneId)); setInput(fresh); setBaseline(fresh); setStage("form"); } }, reloadLatest, reconcile };
};
