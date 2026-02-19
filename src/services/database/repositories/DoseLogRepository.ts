import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../index';
import { DoseLog, DoseStatus, AdherenceStats } from '../../../types';

interface DoseLogRow {
  id: string;
  medication_id: string;
  schedule_id: string;
  scheduled_time: number;
  action_time: number | null;
  status: DoseStatus;
  snoozed_until: number | null;
}

function mapRowToDoseLog(row: DoseLogRow): DoseLog {
  return {
    id: row.id,
    medicationId: row.medication_id,
    scheduleId: row.schedule_id,
    scheduledTime: row.scheduled_time,
    actionTime: row.action_time,
    status: row.status,
    snoozedUntil: row.snoozed_until,
  };
}

export const DoseLogRepository = {
  /**
   * Get dose logs for a medication
   */
  async getByMedicationId(
    medicationId: string,
    limit?: number
  ): Promise<DoseLog[]> {
    let sql = `SELECT * FROM dose_logs
               WHERE medication_id = ?
               ORDER BY scheduled_time DESC`;
    if (limit) {
      sql += ` LIMIT ${limit}`;
    }
    const rows = await query<DoseLogRow>(sql, [medicationId]);
    return rows.map(mapRowToDoseLog);
  },

  /**
   * Get dose logs for a profile (via medications)
   */
  async getByProfileId(
    profileId: string,
    startDate?: number,
    endDate?: number
  ): Promise<DoseLog[]> {
    let sql = `SELECT dl.* FROM dose_logs dl
               INNER JOIN medications m ON dl.medication_id = m.id
               WHERE m.profile_id = ?`;
    const params: (string | number)[] = [profileId];

    if (startDate) {
      sql += ' AND dl.scheduled_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND dl.scheduled_time <= ?';
      params.push(endDate);
    }

    sql += ' ORDER BY dl.scheduled_time DESC';

    const rows = await query<DoseLogRow>(sql, params);
    return rows.map(mapRowToDoseLog);
  },

  /**
   * Get a dose log by scheduled time (to check if already logged)
   */
  async getByScheduledTime(
    scheduleId: string,
    scheduledTime: number
  ): Promise<DoseLog | null> {
    const rows = await query<DoseLogRow>(
      `SELECT * FROM dose_logs
       WHERE schedule_id = ? AND scheduled_time = ?`,
      [scheduleId, scheduledTime]
    );
    return rows.length > 0 ? mapRowToDoseLog(rows[0]) : null;
  },

  /**
   * Get pending dose logs (for missed dose checking)
   */
  async getPending(beforeTime: number): Promise<DoseLog[]> {
    const rows = await query<DoseLogRow>(
      `SELECT * FROM dose_logs
       WHERE status = 'pending' AND scheduled_time < ?
       ORDER BY scheduled_time ASC`,
      [beforeTime]
    );
    return rows.map(mapRowToDoseLog);
  },

  /**
   * Get pending dose for a schedule within a time range (for in-app Take action)
   */
  async getPendingForSchedule(
    scheduleId: string,
    startTime: number,
    endTime: number
  ): Promise<DoseLog | null> {
    const rows = await query<DoseLogRow>(
      `SELECT * FROM dose_logs
       WHERE schedule_id = ?
       AND scheduled_time >= ?
       AND scheduled_time <= ?
       AND status = 'pending'
       ORDER BY scheduled_time ASC
       LIMIT 1`,
      [scheduleId, startTime, endTime]
    );
    return rows.length > 0 ? mapRowToDoseLog(rows[0]) : null;
  },

  /**
   * Get skipped dose for a schedule within a time range (for undo-skip + take)
   */
  async getSkippedForSchedule(
    scheduleId: string,
    startTime: number,
    endTime: number
  ): Promise<DoseLog | null> {
    const rows = await query<DoseLogRow>(
      `SELECT * FROM dose_logs
       WHERE schedule_id = ?
       AND scheduled_time >= ?
       AND scheduled_time <= ?
       AND status = 'skipped'
       ORDER BY scheduled_time ASC
       LIMIT 1`,
      [scheduleId, startTime, endTime]
    );
    return rows.length > 0 ? mapRowToDoseLog(rows[0]) : null;
  },

  /**
   * Create a new dose log
   */
  async create(data: Omit<DoseLog, 'id'>): Promise<DoseLog> {
    const id = uuidv4();

    await execute(
      `INSERT INTO dose_logs
       (id, medication_id, schedule_id, scheduled_time, action_time, status, snoozed_until)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.medicationId,
        data.scheduleId,
        data.scheduledTime,
        data.actionTime,
        data.status,
        data.snoozedUntil || null,
      ]
    );

    return { id, ...data };
  },

  /**
   * Update a dose log status
   */
  async updateStatus(
    id: string,
    status: DoseStatus,
    actionTime?: number
  ): Promise<void> {
    await execute(
      'UPDATE dose_logs SET status = ?, action_time = ?, snoozed_until = NULL WHERE id = ?',
      [status, actionTime || Date.now(), id]
    );
  },

  /**
   * Update snooze time for a dose log
   */
  async updateSnooze(
    id: string,
    snoozedUntil: number
  ): Promise<void> {
    await execute(
      'UPDATE dose_logs SET snoozed_until = ? WHERE id = ?',
      [snoozedUntil, id]
    );
  },

  /**
   * Clear snooze for a dose log
   */
  async clearSnooze(id: string): Promise<void> {
    await execute(
      'UPDATE dose_logs SET snoozed_until = NULL WHERE id = ?',
      [id]
    );
  },

  /**
   * Get dose logs with active snooze for a profile
   */
  async getSnoozedForProfile(profileId: string): Promise<DoseLog[]> {
    const now = Date.now();
    const rows = await query<DoseLogRow>(
      `SELECT dl.* FROM dose_logs dl
       INNER JOIN medications m ON dl.medication_id = m.id
       WHERE m.profile_id = ?
       AND dl.status = 'pending'
       AND dl.snoozed_until IS NOT NULL
       AND dl.snoozed_until > ?
       ORDER BY dl.snoozed_until ASC`,
      [profileId, now]
    );
    return rows.map(mapRowToDoseLog);
  },

  /**
   * Mark pending logs as missed
   */
  async markAsMissed(ids: string[]): Promise<void> {
    if (ids.length === 0) return;

    const placeholders = ids.map(() => '?').join(',');
    await execute(
      `UPDATE dose_logs SET status = 'missed', action_time = ?
       WHERE id IN (${placeholders})`,
      [Date.now(), ...ids]
    );
  },

  /**
   * Get adherence statistics for a profile
   */
  async getAdherenceStats(
    profileId: string,
    startDate?: number,
    endDate?: number
  ): Promise<AdherenceStats> {
    let sql = `SELECT
                 COUNT(*) as total,
                 SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken,
                 SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
                 SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed
               FROM dose_logs dl
               INNER JOIN medications m ON dl.medication_id = m.id
               WHERE m.profile_id = ? AND dl.status != 'pending'`;

    const params: (string | number)[] = [profileId];

    if (startDate) {
      sql += ' AND dl.scheduled_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND dl.scheduled_time <= ?';
      params.push(endDate);
    }

    const rows = await query<{
      total: number;
      taken: number;
      skipped: number;
      missed: number;
    }>(sql, params);

    const stats = rows[0] || { total: 0, taken: 0, skipped: 0, missed: 0 };
    const adherencePercentage =
      stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0;

    return {
      totalDoses: stats.total,
      takenDoses: stats.taken,
      skippedDoses: stats.skipped,
      missedDoses: stats.missed,
      adherencePercentage,
    };
  },

  /**
   * Get adherence stats for a specific medication
   */
  async getMedicationAdherenceStats(
    medicationId: string,
    startDate?: number,
    endDate?: number
  ): Promise<AdherenceStats> {
    let sql = `SELECT
                 COUNT(*) as total,
                 SUM(CASE WHEN status = 'taken' THEN 1 ELSE 0 END) as taken,
                 SUM(CASE WHEN status = 'skipped' THEN 1 ELSE 0 END) as skipped,
                 SUM(CASE WHEN status = 'missed' THEN 1 ELSE 0 END) as missed
               FROM dose_logs
               WHERE medication_id = ? AND status != 'pending'`;

    const params: (string | number)[] = [medicationId];

    if (startDate) {
      sql += ' AND scheduled_time >= ?';
      params.push(startDate);
    }
    if (endDate) {
      sql += ' AND scheduled_time <= ?';
      params.push(endDate);
    }

    const rows = await query<{
      total: number;
      taken: number;
      skipped: number;
      missed: number;
    }>(sql, params);

    const stats = rows[0] || { total: 0, taken: 0, skipped: 0, missed: 0 };
    const adherencePercentage =
      stats.total > 0 ? Math.round((stats.taken / stats.total) * 100) : 0;

    return {
      totalDoses: stats.total,
      takenDoses: stats.taken,
      skippedDoses: stats.skipped,
      missedDoses: stats.missed,
      adherencePercentage,
    };
  },

  /**
   * Delete logs older than a certain date
   */
  async deleteOlderThan(timestamp: number): Promise<void> {
    await execute('DELETE FROM dose_logs WHERE scheduled_time < ?', [
      timestamp,
    ]);
  },

  /**
   * Get today's dose status for a medication
   * Returns the most recent action or pending dose for today
   * Includes yesterday's evening doses (12 hours before today) for after-midnight scenarios
   */
  async getTodayStatusForMedication(medicationId: string): Promise<DoseLog | null> {
    const today = new Date();
    const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const endOfDay = startOfDay + 24 * 60 * 60 * 1000 - 1;
    // Include previous day's evening doses (12 hours before today) for after-midnight actions
    const searchStart = startOfDay - 12 * 60 * 60 * 1000;

    // First try to get any taken/skipped dose (most recent action)
    let rows = await query<DoseLogRow>(
      `SELECT * FROM dose_logs
       WHERE medication_id = ?
       AND scheduled_time >= ?
       AND scheduled_time <= ?
       AND status IN ('taken', 'skipped')
       ORDER BY action_time DESC
       LIMIT 1`,
      [medicationId, searchStart, endOfDay]
    );

    if (rows.length > 0) {
      return mapRowToDoseLog(rows[0]);
    }

    // If no taken/skipped, get the next pending dose (might be snoozed)
    rows = await query<DoseLogRow>(
      `SELECT * FROM dose_logs
       WHERE medication_id = ?
       AND scheduled_time >= ?
       AND scheduled_time <= ?
       AND status = 'pending'
       ORDER BY scheduled_time ASC
       LIMIT 1`,
      [medicationId, searchStart, endOfDay]
    );

    return rows.length > 0 ? mapRowToDoseLog(rows[0]) : null;
  },
};
