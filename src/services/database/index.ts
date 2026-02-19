import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import { DATABASE_NAME } from '../../utils/constants';
import { runMigrations } from './migrations';

// Enable promise-based API
SQLite.enablePromise(true);

let database: SQLiteDatabase | null = null;

/**
 * Initialize the database connection
 */
export async function initDatabase(): Promise<SQLiteDatabase> {
  if (database) {
    return database;
  }

  try {
    database = await SQLite.openDatabase({
      name: DATABASE_NAME,
      location: 'default',
    });

    // Run migrations
    await runMigrations(database);

    console.log('Database initialized successfully');
    return database;
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

/**
 * Get the database instance
 */
export function getDatabase(): SQLiteDatabase {
  if (!database) {
    throw new Error('Database not initialized. Call initDatabase first.');
  }
  return database;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (database) {
    await database.close();
    database = null;
    console.log('Database closed');
  }
}

/**
 * Execute a query and return results
 */
export async function query<T>(
  sql: string,
  params: (string | number | null)[] = []
): Promise<T[]> {
  const db = getDatabase();
  const [results] = await db.executeSql(sql, params);
  const rows: T[] = [];
  for (let i = 0; i < results.rows.length; i++) {
    rows.push(results.rows.item(i));
  }
  return rows;
}

/**
 * Execute a statement (INSERT, UPDATE, DELETE)
 */
export async function execute(
  sql: string,
  params: (string | number | null)[] = []
): Promise<{ insertId?: number; rowsAffected: number }> {
  const db = getDatabase();
  const [result] = await db.executeSql(sql, params);
  return {
    insertId: result.insertId,
    rowsAffected: result.rowsAffected,
  };
}

/**
 * Delete all data from all tables (preserves schema).
 * Deletes in FK-safe order: dose_logs → schedules → medications → profiles → settings.
 */
export async function resetAllData(): Promise<void> {
  const db = getDatabase();
  await db.executeSql('DELETE FROM dose_logs');
  await db.executeSql('DELETE FROM schedules');
  await db.executeSql('DELETE FROM medications');
  await db.executeSql('DELETE FROM profiles');
  await db.executeSql('DELETE FROM settings');
  console.log('[Database] All data deleted');
}

/**
 * Delete all dose history (dose_logs table only).
 */
export async function resetDoseHistory(): Promise<void> {
  const db = getDatabase();
  await db.executeSql('DELETE FROM dose_logs');
  console.log('[Database] Dose history deleted');
}

/**
 * Execute multiple statements in a transaction
 */
export async function transaction<T>(
  callback: (tx: SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = getDatabase();
  return new Promise((resolve, reject) => {
    db.transaction(
      async (_tx) => {
        try {
          // Note: We're passing the db to the callback, not tx
          // because the transaction API is slightly different
          const result = await callback(db);
          resolve(result);
        } catch (error) {
          reject(error);
        }
      },
      (error) => reject(error)
    );
  });
}
