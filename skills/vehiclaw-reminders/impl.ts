// skills/vehiclaw-reminders/impl.ts
// SQLite-backed reminder store with node-cron scheduling.
// Reminders fire by broadcasting a `reminder_alert` event to all connected car UI clients.

import Database from 'better-sqlite3';
import cron from 'node-cron';
import path from 'path';
import fs from 'fs';
import { log } from '../../src/logger.js';
import { config } from '../../src/config.js';

export interface Reminder {
  id: number;
  message: string;
  remindAt: string;   // ISO 8601
  repeat: 'none' | 'daily' | 'weekly';
  active: boolean;
  createdAt: string;
}

export type ReminderBroadcastFn = (payload: { type: 'reminder_alert'; message: string }) => void;

let db: Database.Database;
let broadcastFn: ReminderBroadcastFn;
let schedulerTask: cron.ScheduledTask | null = null;

// ── Database init ──────────────────────────────────────────────────────────────

function getDb(): Database.Database {
  if (db) return db;

  const dataDir = path.resolve(config.dataDir);
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

  db = new Database(path.join(dataDir, 'reminders.db'));

  db.exec(`
    CREATE TABLE IF NOT EXISTS reminders (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      message    TEXT NOT NULL,
      remind_at  TEXT NOT NULL,
      repeat     TEXT NOT NULL DEFAULT 'none',
      active     INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  return db;
}

// ── Tool implementations ───────────────────────────────────────────────────────

export function setReminder(params: {
  message: string;
  remind_at: string;
  repeat?: 'none' | 'daily' | 'weekly';
}): Reminder {
  const { message, remind_at, repeat = 'none' } = params;

  // Validate the datetime is in the future
  const remindDate = new Date(remind_at);
  if (isNaN(remindDate.getTime())) {
    throw new Error(`Invalid datetime: ${remind_at}`);
  }
  if (remindDate.getTime() < Date.now()) {
    throw new Error('Reminder time is in the past');
  }

  const stmt = getDb().prepare(
    'INSERT INTO reminders (message, remind_at, repeat) VALUES (?, ?, ?)'
  );
  const result = stmt.run(message, remindDate.toISOString(), repeat);

  log(`Reminder set: "${message}" at ${remindDate.toLocaleString()}`);

  return {
    id: result.lastInsertRowid as number,
    message,
    remindAt: remindDate.toISOString(),
    repeat,
    active: true,
    createdAt: new Date().toISOString(),
  };
}

export function listReminders(): Reminder[] {
  const rows = getDb()
    .prepare('SELECT * FROM reminders WHERE active = 1 AND remind_at > ? ORDER BY remind_at')
    .all(new Date().toISOString()) as Array<Record<string, unknown>>;

  return rows.map(r => ({
    id: r.id as number,
    message: r.message as string,
    remindAt: r.remind_at as string,
    repeat: r.repeat as Reminder['repeat'],
    active: (r.active as number) === 1,
    createdAt: r.created_at as string,
  }));
}

export function deleteReminder(params: { id: number }): boolean {
  const result = getDb()
    .prepare('UPDATE reminders SET active = 0 WHERE id = ?')
    .run(params.id);
  return result.changes > 0;
}

// ── Scheduler ──────────────────────────────────────────────────────────────────

export function startReminderScheduler(broadcast: ReminderBroadcastFn) {
  broadcastFn = broadcast;
  getDb();  // ensure DB is initialized

  // Check every minute for due reminders
  schedulerTask = cron.schedule('* * * * *', () => {
    checkDueReminders();
  });

  log('Reminder scheduler started');
}

export function stopReminderScheduler() {
  schedulerTask?.stop();
}

function checkDueReminders() {
  const now = new Date();
  const windowEnd = new Date(now.getTime() + 60000).toISOString();  // next 60s
  const nowIso = now.toISOString();

  const due = getDb()
    .prepare('SELECT * FROM reminders WHERE active = 1 AND remind_at BETWEEN ? AND ?')
    .all(nowIso, windowEnd) as Array<Record<string, unknown>>;

  for (const reminder of due) {
    const repeat = reminder.repeat as string;
    const message = reminder.message as string;

    log(`Firing reminder: "${message}"`);
    broadcastFn({ type: 'reminder_alert', message });

    if (repeat === 'none') {
      getDb().prepare('UPDATE reminders SET active = 0 WHERE id = ?').run(reminder.id as number);
    } else {
      // Advance to next occurrence
      const remindAt = new Date(reminder.remind_at as string);
      if (repeat === 'daily')  remindAt.setDate(remindAt.getDate() + 1);
      if (repeat === 'weekly') remindAt.setDate(remindAt.getDate() + 7);
      getDb()
        .prepare('UPDATE reminders SET remind_at = ? WHERE id = ?')
        .run(remindAt.toISOString(), reminder.id as number);
    }
  }
}

export const reminderTools = {
  set_reminder: setReminder,
  list_reminders: listReminders,
  delete_reminder: deleteReminder,
};
