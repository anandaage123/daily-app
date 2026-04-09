import AsyncStorage from '@react-native-async-storage/async-storage';

type DayKey = string; // YYYY-MM-DD (UTC, via toISOString split)

type ActivityType = 'focus' | 'todo' | 'habit';

export interface DailyLogEvent {
  id: string;
  type: ActivityType;
  title: string;
  details?: string;
  startTs?: number;
  endTs?: number;
  durationMin?: number;
  createdAt: number; // timestamp of event creation (used for ordering)
}

interface DailyLogStateV1 {
  version: 1;
  byDay: Record<DayKey, { events: DailyLogEvent[] }>;
}

interface Note {
  id: string;
  title: string;
  content: string;
  date: string;
  dateRaw: number;
  mood?: string;
  category: string;
  isPinned?: boolean;
  extras?: {
    journalNotes?: { id: string; text: string; time: string }[];
  };
}

const NOTES_KEY = '@daily_notes_v3';
const DAILY_LOG_KEY = '@daily_log_state_v1';

const pad2 = (n: number) => n.toString().padStart(2, '0');

function getDayKey(ts: number): DayKey {
  return new Date(ts).toISOString().split('T')[0];
}

function dayKeyToUtcMidnightTs(dayKey: DayKey): number {
  // dayKey is YYYY-MM-DD
  return new Date(`${dayKey}T00:00:00.000Z`).getTime();
}

function formatNoteDate(ts: number) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function safeJsonParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function loadState(): Promise<DailyLogStateV1> {
  const raw = await AsyncStorage.getItem(DAILY_LOG_KEY);
  const parsed = safeJsonParse<DailyLogStateV1 | null>(raw, null);
  if (parsed && parsed.version === 1 && parsed.byDay) return parsed;
  return { version: 1, byDay: {} };
}

async function saveState(state: DailyLogStateV1) {
  await AsyncStorage.setItem(DAILY_LOG_KEY, JSON.stringify(state));
}

async function loadNotes(): Promise<Note[]> {
  const raw = await AsyncStorage.getItem(NOTES_KEY);
  return safeJsonParse<Note[]>(raw, []);
}

async function saveNotes(notes: Note[]) {
  await AsyncStorage.setItem(NOTES_KEY, JSON.stringify(notes));
}

function buildDailyLogContent(dayKey: DayKey, events: DailyLogEvent[]): string {
  const focus = events
    .filter(e => e.type === 'focus')
    .sort((a, b) => (a.startTs ?? a.createdAt) - (b.startTs ?? b.createdAt));

  const completedTodos = events
    .filter(e => e.type === 'todo')
    .sort((a, b) => b.createdAt - a.createdAt);

  const completedHabits = events
    .filter(e => e.type === 'habit')
    .sort((a, b) => b.createdAt - a.createdAt);

  const totalFocusMin = focus.reduce((sum, e) => sum + (e.durationMin ?? 0), 0);

  const lines: string[] = [];
  lines.push(`DATE: ${dayKey}`);
  lines.push('');
  lines.push('TIMESHEET');
  lines.push('────────');
  if (focus.length === 0) {
    lines.push('- No focus sessions logged.');
  } else {
    focus.forEach((s) => {
      const start = s.startTs ? formatTime(s.startTs) : '—';
      const end = s.endTs ? formatTime(s.endTs) : '—';
      const dur = s.durationMin != null ? `${s.durationMin}m` : '—';
      const meta = [s.details].filter(Boolean).join(' · ');
      lines.push(`- ${start} → ${end} (${dur}) — ${s.title}${meta ? ` (${meta})` : ''}`);
    });
    lines.push('');
    lines.push(`Total focused: ${totalFocusMin} minutes`);
  }

  lines.push('');
  lines.push('COMPLETED');
  lines.push('─────────');

  if (completedHabits.length === 0 && completedTodos.length === 0) {
    lines.push('- Nothing completed yet.');
  } else {
    if (completedHabits.length > 0) {
      lines.push('Habits:');
      completedHabits.forEach(h => {
        const at = formatTime(h.createdAt);
        lines.push(`- ${at} ✓ ${h.title}${h.details ? ` (${h.details})` : ''}`);
      });
      lines.push('');
    }
    if (completedTodos.length > 0) {
      lines.push('Todos:');
      completedTodos.forEach(t => {
        const at = formatTime(t.createdAt);
        lines.push(`- ${at} ✓ ${t.title}${t.details ? ` (${t.details})` : ''}`);
      });
    }
  }

  return lines.join('\n');
}

async function upsertDailyLogNote(dayKey: DayKey, events: DailyLogEvent[]): Promise<void> {
  const notes = await loadNotes();
  const dateRaw = dayKeyToUtcMidnightTs(dayKey);
  const id = `daily-log-${dayKey}`;
  const title = `Daily Log — ${formatNoteDate(dateRaw)}`;
  const content = buildDailyLogContent(dayKey, events);

  const note: Note = {
    id,
    title,
    content,
    date: formatNoteDate(dateRaw),
    dateRaw,
    mood: '😀',
    category: 'Work',
    isPinned: false,
  };

  const existing = notes.find(n => n.id === id);
  const merged: Note = existing ? { ...existing, ...note, extras: existing.extras } : note;
  const updated = existing ? notes.map(n => (n.id === id ? merged : n)) : [note, ...notes];
  await saveNotes(updated);
}

async function appendEvent(ts: number, event: Omit<DailyLogEvent, 'createdAt'> & { createdAt?: number }) {
  const state = await loadState();
  const dayKey = getDayKey(ts);
  const day = state.byDay[dayKey] ?? { events: [] };

  const newEvent: DailyLogEvent = {
    ...event,
    createdAt: event.createdAt ?? ts,
  };

  // Deduplicate by id (id should be deterministic for "once per completion" events)
  const without = day.events.filter(e => e.id !== newEvent.id);
  const nextEvents = [newEvent, ...without].slice(0, 500);

  state.byDay[dayKey] = { events: nextEvents };
  await saveState(state);
  await upsertDailyLogNote(dayKey, nextEvents);
}

export async function recordTodoCompleted(args: { todoId: string; text: string; completedAt: number }) {
  const { todoId, text, completedAt } = args;
  const id = `todo:${todoId}:${getDayKey(completedAt)}`;
  await appendEvent(completedAt, {
    id,
    type: 'todo',
    title: text,
    createdAt: completedAt,
  });
}

export async function recordHabitCompleted(args: { habitId: string; name: string; completedAt: number; streak?: number }) {
  const { habitId, name, completedAt, streak } = args;
  const id = `habit:${habitId}:${getDayKey(completedAt)}`;
  await appendEvent(completedAt, {
    id,
    type: 'habit',
    title: name,
    details: streak != null ? `streak ${streak}` : undefined,
    createdAt: completedAt,
  });
}

export async function recordFocusSession(args: {
  startTs: number;
  endTs: number;
  title: string;
  tag?: string;
  mode?: string;
}) {
  const { startTs, endTs, title, tag, mode } = args;
  const durationMin = Math.max(0, Math.round((endTs - startTs) / 60000));
  const dayKey = getDayKey(startTs);
  const id = `focus:${dayKey}:${startTs}`;
  await appendEvent(startTs, {
    id,
    type: 'focus',
    title,
    details: [tag ? `#${tag}` : null, mode ? `mode:${mode}` : null].filter(Boolean).join(' · ') || undefined,
    startTs,
    endTs,
    durationMin,
    createdAt: endTs,
  });
}

export async function ensureDailyLogForToday() {
  const now = Date.now();
  const state = await loadState();
  const dayKey = getDayKey(now);
  const day = state.byDay[dayKey] ?? { events: [] };
  state.byDay[dayKey] = day;
  await saveState(state);
  await upsertDailyLogNote(dayKey, day.events);
}

export async function removeEvent(ts: number, id: string) {
  const state = await loadState();
  const dayKey = getDayKey(ts);
  const day = state.byDay[dayKey];
  if (!day) return;
  
  day.events = day.events.filter(e => e.id !== id);
  await saveState(state);
  await upsertDailyLogNote(dayKey, day.events);
}

export async function removeTodoCompleted(args: { todoId: string; completedAt: number }) {
  const { todoId, completedAt } = args;
  const id = `todo:${todoId}:${getDayKey(completedAt)}`;
  await removeEvent(completedAt, id);
}

export async function removeHabitCompleted(args: { habitId: string; completedAt: number }) {
  const { habitId, completedAt } = args;
  const id = `habit:${habitId}:${getDayKey(completedAt)}`;
  await removeEvent(completedAt, id);
}

