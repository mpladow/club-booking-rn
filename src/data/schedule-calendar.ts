// File: src/data/schedule-calendar.ts
import { type ClubDetails } from "./administration";
import { monthRange, WEEKDAYS, type TimeslotDetails, type WeeklyScheduleDetails } from "./scheduling";

export interface RecurringPreview { schedule: WeeklyScheduleDetails; localSessionDate: string }
const addDays = (date: string, days: number): string => {
  // These are club-local calendar dates, not instants; UTC arithmetic avoids DST shifts.
  const value: Date = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};
export const bookingWindowEnd = (today: string, days: number): string => addDays(today, days - 1);

export const recurringPreviews = (month: string, today: string, club: Pick<ClubDetails, "bookingWindowDays" | "commencementDate">,
  schedules: readonly WeeklyScheduleDetails[], persisted: readonly TimeslotDetails[]): RecurringPreview[] => {
  const range = monthRange(month);
  const first: string = [range.from, addDays(today, club.bookingWindowDays), club.commencementDate].sort().at(-1)!;
  const previews: RecurringPreview[] = [];
  // Include closed/customised occurrences in this lookup: their persisted state wins,
  // even when the calendar deliberately hides a closed occurrence.
  const existing = new Set(persisted.filter((slot: TimeslotDetails): boolean => slot.recurringScheduleId !== null)
    .map((slot: TimeslotDetails): string => `${slot.recurringScheduleId}:${slot.localSessionDate}`));
  for (const schedule of schedules) {
    const start: string = schedule.scheduleStartDate > first ? schedule.scheduleStartDate : first;
    const end: string = schedule.scheduleEndDate && schedule.scheduleEndDate < range.to ? schedule.scheduleEndDate : range.to;
    if (start > end) continue;
    const weekday: number = new Date(`${start}T12:00:00Z`).getUTCDay();
    for (let date: string = addDays(start, (WEEKDAYS.indexOf(schedule.weekday) - weekday + 7) % 7); date <= end; date = addDays(date, 7)) {
      if (!existing.has(`${schedule.id}:${date}`)) previews.push({ schedule, localSessionDate: date });
    }
  }
  return previews.sort((a: RecurringPreview, b: RecurringPreview): number => a.localSessionDate.localeCompare(b.localSessionDate)
    || a.schedule.startTime.localeCompare(b.schedule.startTime));
};
