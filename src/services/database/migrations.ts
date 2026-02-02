import { SQLiteDatabase } from 'react-native-sqlite-storage';

interface Migration {
  version: number;
  up: string[];
}

const migrations: Migration[] = [
  {
    version: 1,
    up: [
      // Profiles table
      `CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_caretaker INTEGER DEFAULT 0,
        avatar_color TEXT,
        created_at INTEGER NOT NULL
      )`,

      // Medications table
      `CREATE TABLE IF NOT EXISTS medications (
        id TEXT PRIMARY KEY,
        profile_id TEXT NOT NULL,
        name TEXT NOT NULL,
        dosage TEXT,
        notes TEXT,
        color TEXT DEFAULT '#629FAD',
        stock_count INTEGER DEFAULT 0,
        stock_reminder_threshold INTEGER DEFAULT 7,
        is_active INTEGER DEFAULT 1,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
      )`,

      // Schedules table
      `CREATE TABLE IF NOT EXISTS schedules (
        id TEXT PRIMARY KEY,
        medication_id TEXT NOT NULL,
        schedule_type TEXT NOT NULL,
        times_of_day TEXT NOT NULL,
        days_of_week TEXT,
        interval_days INTEGER,
        start_date INTEGER NOT NULL,
        end_date INTEGER,
        duration_days INTEGER,
        is_active INTEGER DEFAULT 1,
        FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
      )`,

      // Dose logs table
      `CREATE TABLE IF NOT EXISTS dose_logs (
        id TEXT PRIMARY KEY,
        medication_id TEXT NOT NULL,
        schedule_id TEXT NOT NULL,
        scheduled_time INTEGER NOT NULL,
        action_time INTEGER,
        status TEXT NOT NULL,
        FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
        FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
      )`,

      // Settings table
      `CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )`,

      // Create indexes for better query performance
      `CREATE INDEX IF NOT EXISTS idx_medications_profile
       ON medications(profile_id)`,

      `CREATE INDEX IF NOT EXISTS idx_schedules_medication
       ON schedules(medication_id)`,

      `CREATE INDEX IF NOT EXISTS idx_dose_logs_medication
       ON dose_logs(medication_id)`,

      `CREATE INDEX IF NOT EXISTS idx_dose_logs_scheduled_time
       ON dose_logs(scheduled_time)`,

      `CREATE INDEX IF NOT EXISTS idx_dose_logs_status
       ON dose_logs(status)`,
    ],
  },
  {
    version: 2,
    up: [
      // Add is_stock_indefinite column to medications table
      `ALTER TABLE medications ADD COLUMN is_stock_indefinite INTEGER DEFAULT 0`,
    ],
  },
  {
    version: 3,
    up: [
      // Add snoozed_until column to dose_logs table for tracking snooze state
      `ALTER TABLE dose_logs ADD COLUMN snoozed_until INTEGER`,
    ],
  },
];

/**
 * Get the current database version
 */
async function getDatabaseVersion(db: SQLiteDatabase): Promise<number> {
  try {
    const [result] = await db.executeSql(
      "SELECT value FROM settings WHERE key = 'db_version'"
    );
    if (result.rows.length > 0) {
      return parseInt(result.rows.item(0).value, 10);
    }
    return 0;
  } catch {
    return 0;
  }
}

/**
 * Set the database version
 */
async function setDatabaseVersion(
  db: SQLiteDatabase,
  version: number
): Promise<void> {
  await db.executeSql(
    `INSERT OR REPLACE INTO settings (key, value) VALUES ('db_version', ?)`,
    [version.toString()]
  );
}

/**
 * Run all pending migrations
 */
export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  // First, ensure settings table exists for version tracking
  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const currentVersion = await getDatabaseVersion(db);
  console.log(`Current database version: ${currentVersion}`);

  for (const migration of migrations) {
    if (migration.version > currentVersion) {
      console.log(`Running migration to version ${migration.version}`);

      for (const sql of migration.up) {
        try {
          await db.executeSql(sql);
        } catch (error) {
          console.error(`Migration error (v${migration.version}):`, error);
          throw error;
        }
      }

      await setDatabaseVersion(db, migration.version);
      console.log(`Migrated to version ${migration.version}`);
    }
  }

  console.log('All migrations complete');
}
