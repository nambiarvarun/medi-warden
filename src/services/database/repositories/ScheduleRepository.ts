import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../index';
import { Schedule, ScheduleType } from '../../../types';

interface ScheduleRow {
  id: string;
  medication_id: string;
  schedule_type: ScheduleType;
  times_of_day: string;
  days_of_week: string | null;
  interval_days: number | null;
  start_date: number;
  end_date: number | null;
  duration_days: number | null;
  is_active: number;
}

function mapRowToSchedule(row: ScheduleRow): Schedule {
  return {
    id: row.id,
    medicationId: row.medication_id,
    scheduleType: row.schedule_type,
    timesOfDay: JSON.parse(row.times_of_day),
    daysOfWeek: row.days_of_week ? JSON.parse(row.days_of_week) : null,
    intervalDays: row.interval_days,
    startDate: row.start_date,
    endDate: row.end_date,
    durationDays: row.duration_days,
    isActive: row.is_active === 1,
  };
}

export const ScheduleRepository = {
  /**
   * Get all schedules for a medication
   */
  async getByMedicationId(medicationId: string): Promise<Schedule[]> {
    const rows = await query<ScheduleRow>(
      'SELECT * FROM schedules WHERE medication_id = ?',
      [medicationId]
    );
    return rows.map(mapRowToSchedule);
  },

  /**
   * Get active schedules for a medication
   */
  async getActiveByMedicationId(medicationId: string): Promise<Schedule[]> {
    const rows = await query<ScheduleRow>(
      'SELECT * FROM schedules WHERE medication_id = ? AND is_active = 1',
      [medicationId]
    );
    return rows.map(mapRowToSchedule);
  },

  /**
   * Get a schedule by ID
   */
  async getById(id: string): Promise<Schedule | null> {
    const rows = await query<ScheduleRow>(
      'SELECT * FROM schedules WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? mapRowToSchedule(rows[0]) : null;
  },

  /**
   * Get all active schedules for a profile (via medications)
   */
  async getActiveByProfileId(profileId: string): Promise<Schedule[]> {
    const rows = await query<ScheduleRow>(
      `SELECT s.* FROM schedules s
       INNER JOIN medications m ON s.medication_id = m.id
       WHERE m.profile_id = ? AND s.is_active = 1 AND m.is_active = 1`,
      [profileId]
    );
    return rows.map(mapRowToSchedule);
  },

  /**
   * Create a new schedule
   */
  async create(data: Omit<Schedule, 'id'>): Promise<Schedule> {
    const id = uuidv4();

    await execute(
      `INSERT INTO schedules
       (id, medication_id, schedule_type, times_of_day, days_of_week, interval_days, start_date, end_date, duration_days, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.medicationId,
        data.scheduleType,
        JSON.stringify(data.timesOfDay),
        data.daysOfWeek ? JSON.stringify(data.daysOfWeek) : null,
        data.intervalDays,
        data.startDate,
        data.endDate,
        data.durationDays,
        data.isActive ? 1 : 0,
      ]
    );

    return { id, ...data };
  },

  /**
   * Update a schedule
   */
  async update(
    id: string,
    data: Partial<Omit<Schedule, 'id' | 'medicationId'>>
  ): Promise<void> {
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.scheduleType !== undefined) {
      updates.push('schedule_type = ?');
      params.push(data.scheduleType);
    }
    if (data.timesOfDay !== undefined) {
      updates.push('times_of_day = ?');
      params.push(JSON.stringify(data.timesOfDay));
    }
    if (data.daysOfWeek !== undefined) {
      updates.push('days_of_week = ?');
      params.push(data.daysOfWeek ? JSON.stringify(data.daysOfWeek) : null);
    }
    if (data.intervalDays !== undefined) {
      updates.push('interval_days = ?');
      params.push(data.intervalDays);
    }
    if (data.startDate !== undefined) {
      updates.push('start_date = ?');
      params.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      updates.push('end_date = ?');
      params.push(data.endDate);
    }
    if (data.durationDays !== undefined) {
      updates.push('duration_days = ?');
      params.push(data.durationDays);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }

    if (updates.length === 0) return;

    params.push(id);
    await execute(
      `UPDATE schedules SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  },

  /**
   * Delete a schedule
   */
  async delete(id: string): Promise<void> {
    await execute('DELETE FROM schedules WHERE id = ?', [id]);
  },

  /**
   * Delete all schedules for a medication
   */
  async deleteByMedicationId(medicationId: string): Promise<void> {
    await execute('DELETE FROM schedules WHERE medication_id = ?', [
      medicationId,
    ]);
  },
};
