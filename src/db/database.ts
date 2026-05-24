import * as SQLite from 'expo-sqlite';

let db: SQLite.SQLiteDatabase | null = null;

export function getDB() {
  if (!db) {
    db = SQLite.openDatabaseSync('touchgrass.db');
  }
  return db;
}

export function initDatabase() {
  const database = getDB();
  
  // Create tables
  database.execSync(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      app_package TEXT UNIQUE,
      start_time TEXT, -- e.g., "09:00"
      end_time TEXT,   -- e.g., "17:00"
      is_enabled INTEGER DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role TEXT, -- "user" | "ai"
      message TEXT,
      timestamp INTEGER,
      mood TEXT -- "neutral" | "sarcastic" | "annoyed" | "angry"
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Insert default settings if they don't exist
  try {
    database.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('openai_api_key', '');`);
    database.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('ai_mood', 'neutral');`);
    database.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('consequence_level', '0');`);
    database.runSync(`INSERT OR IGNORE INTO settings (key, value) VALUES ('difficulty', 'medium');`);
  } catch (e) {
    console.error('Error inserting default settings:', e);
  }
}

export function getSetting(key: string): string {
  try {
    const database = getDB();
    const row = database.getFirstSync<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
    return row ? row.value : '';
  } catch (e) {
    console.error(`Error getting setting ${key}:`, e);
    return '';
  }
}

export function setSetting(key: string, value: string) {
  try {
    const database = getDB();
    database.runSync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  } catch (e) {
    console.error(`Error setting ${key}:`, e);
  }
}

export interface Schedule {
  id: number;
  app_package: string;
  start_time: string;
  end_time: string;
  is_enabled: boolean;
}

export function getSchedules(): Schedule[] {
  try {
    const database = getDB();
    const rows = database.getAllSync<{ id: number; app_package: string; start_time: string; end_time: string; is_enabled: number }>('SELECT * FROM schedules');
    return rows.map(row => ({
      id: row.id,
      app_package: row.app_package,
      start_time: row.start_time,
      end_time: row.end_time,
      is_enabled: row.is_enabled === 1,
    }));
  } catch (e) {
    console.error('Error getting schedules:', e);
    return [];
  }
}

export function addOrUpdateSchedule(appPackage: string, startTime: string, endTime: string, isEnabled: boolean) {
  try {
    const database = getDB();
    const enabledInt = isEnabled ? 1 : 0;
    database.runSync(
      'INSERT OR REPLACE INTO schedules (app_package, start_time, end_time, is_enabled) VALUES (?, ?, ?, ?)',
      [appPackage, startTime, endTime, enabledInt]
    );
  } catch (e) {
    console.error('Error saving schedule:', e);
  }
}

export function deleteSchedule(appPackage: string) {
  try {
    const database = getDB();
    database.runSync('DELETE FROM schedules WHERE app_package = ?', [appPackage]);
  } catch (e) {
    console.error('Error deleting schedule:', e);
  }
}

export interface ChatMessage {
  id?: number;
  role: 'user' | 'ai';
  message: string;
  timestamp: number;
  mood: string;
}

export function getChatHistory(): ChatMessage[] {
  try {
    const database = getDB();
    const rows = database.getAllSync<{ id: number; role: string; message: string; timestamp: number; mood: string }>(
      'SELECT * FROM chat_history ORDER BY timestamp ASC'
    );
    return rows.map(row => ({
      id: row.id,
      role: row.role as 'user' | 'ai',
      message: row.message,
      timestamp: row.timestamp,
      mood: row.mood,
    }));
  } catch (e) {
    console.error('Error getting chat history:', e);
    return [];
  }
}

export function addChatMessage(role: 'user' | 'ai', message: string, mood: string): ChatMessage {
  const timestamp = Date.now();
  try {
    const database = getDB();
    database.runSync(
      'INSERT INTO chat_history (role, message, timestamp, mood) VALUES (?, ?, ?, ?)',
      [role, message, timestamp, mood]
    );
  } catch (e) {
    console.error('Error saving chat message:', e);
  }
  return { role, message, timestamp, mood };
}

export function clearChatHistory() {
  try {
    const database = getDB();
    database.runSync('DELETE FROM chat_history');
  } catch (e) {
    console.error('Error clearing chat history:', e);
  }
}
