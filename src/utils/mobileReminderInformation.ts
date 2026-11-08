export type MobileReminder = {
  id: string;
  title: string;
  body: string;
  kind?: string;
  startAt?: string;
  endAt?: string;
  recipients?: string[];
  schoolId?: string;
  active?: boolean;
};

export const reminderTime = (value: unknown): number => {
  const raw = String(value || "").trim();
  if (!raw) return Number.NaN;
  // datetime-local is a Türkiye local time; parse its timestamp consistently.
  const time = Date.parse(/Z$|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : `${raw.slice(0, 16)}:00+03:00`);
  return time;
};

export const inNext48Hours = (value: unknown, now = Date.now()): boolean => {
  const time = reminderTime(value);
  return Number.isFinite(time) && time >= now && time <= now + 48 * 60 * 60 * 1000;
};

export const activeCustomReminders = (
  rows: unknown,
  recipient: "student" | "parent" | "teacher" | "admin",
  schoolId: string,
  now = Date.now(),
): MobileReminder[] => (Array.isArray(rows) ? rows : [])
  .filter((row: MobileReminder) =>
    row && row.active !== false &&
    Array.isArray(row.recipients) && row.recipients.includes(recipient) &&
    (!row.schoolId || (schoolId && String(row.schoolId) === String(schoolId))) &&
    Number.isFinite(reminderTime(row.startAt)) &&
    Number.isFinite(reminderTime(row.endAt)) &&
    reminderTime(row.startAt) <= now && reminderTime(row.endAt) > now
  )
  .sort((a: MobileReminder, b: MobileReminder) => reminderTime(a.startAt) - reminderTime(b.startAt));

export const localExamTimestamp = (date: unknown, time: unknown): string => {
  const dateText = String(date || "").trim();
  const day = /^\d{4}-\d{2}-\d{2}/.exec(dateText)?.[0];
  const match = /^(\d{1,2}):(\d{2})/.exec(String(time || "").trim());
  return day && match ? `${day}T${match[1].padStart(2, "0")}:${match[2]}` : "";
};

export const displayExamMoment = (date: unknown, time: unknown): string =>
  [String(date || "").slice(0, 10), String(time || "").trim() ? `Saat ${time}` : "Saat belirtilmedi"].filter(Boolean).join(" · ");
