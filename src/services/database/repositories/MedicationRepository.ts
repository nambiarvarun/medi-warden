import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../index';
import { Medication } from '../../../types';

interface MedicationRow {
  id: string;
  profile_id: string;
  name: string;
  dosage: string | null;
  notes: string | null;
  color: string;
  stock_count: number;
  stock_reminder_threshold: number;
  is_stock_indefinite: number;
  is_active: number;
  created_at: number;
}

function mapRowToMedication(row: MedicationRow): Medication {
  return {
    id: row.id,
    profileId: row.profile_id,
    name: row.name,
    dosage: row.dosage || '',
    notes: row.notes || '',
    color: row.color,
    stockCount: row.stock_count,
    stockReminderThreshold: row.stock_reminder_threshold,
    isStockIndefinite: row.is_stock_indefinite === 1,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export const MedicationRepository = {
  /**
   * Get all medications for a profile
   */
  async getByProfileId(profileId: string): Promise<Medication[]> {
    const rows = await query<MedicationRow>(
      'SELECT * FROM medications WHERE profile_id = ? ORDER BY created_at DESC',
      [profileId]
    );
    return rows.map(mapRowToMedication);
  },

  /**
   * Get active medications for a profile
   */
  async getActiveByProfileId(profileId: string): Promise<Medication[]> {
    const rows = await query<MedicationRow>(
      'SELECT * FROM medications WHERE profile_id = ? AND is_active = 1 ORDER BY name ASC',
      [profileId]
    );
    return rows.map(mapRowToMedication);
  },

  /**
   * Get a medication by ID
   */
  async getById(id: string): Promise<Medication | null> {
    const rows = await query<MedicationRow>(
      'SELECT * FROM medications WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? mapRowToMedication(rows[0]) : null;
  },

  /**
   * Get medications that need refill (excludes indefinite stock)
   */
  async getLowStock(profileId: string): Promise<Medication[]> {
    const rows = await query<MedicationRow>(
      `SELECT * FROM medications
       WHERE profile_id = ?
       AND is_active = 1
       AND is_stock_indefinite = 0
       AND stock_count <= stock_reminder_threshold
       ORDER BY stock_count ASC`,
      [profileId]
    );
    return rows.map(mapRowToMedication);
  },

  /**
   * Create a new medication
   */
  async create(
    data: Omit<Medication, 'id' | 'createdAt'>
  ): Promise<Medication> {
    const id = uuidv4();
    const createdAt = Date.now();

    await execute(
      `INSERT INTO medications
       (id, profile_id, name, dosage, notes, color, stock_count, stock_reminder_threshold, is_stock_indefinite, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.profileId,
        data.name,
        data.dosage || null,
        data.notes || null,
        data.color,
        data.stockCount,
        data.stockReminderThreshold,
        data.isStockIndefinite ? 1 : 0,
        data.isActive ? 1 : 0,
        createdAt,
      ]
    );

    return {
      id,
      createdAt,
      ...data,
    };
  },

  /**
   * Update a medication
   */
  async update(
    id: string,
    data: Partial<Omit<Medication, 'id' | 'profileId' | 'createdAt'>>
  ): Promise<void> {
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.dosage !== undefined) {
      updates.push('dosage = ?');
      params.push(data.dosage || null);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      params.push(data.notes || null);
    }
    if (data.color !== undefined) {
      updates.push('color = ?');
      params.push(data.color);
    }
    if (data.stockCount !== undefined) {
      updates.push('stock_count = ?');
      params.push(data.stockCount);
    }
    if (data.stockReminderThreshold !== undefined) {
      updates.push('stock_reminder_threshold = ?');
      params.push(data.stockReminderThreshold);
    }
    if (data.isStockIndefinite !== undefined) {
      updates.push('is_stock_indefinite = ?');
      params.push(data.isStockIndefinite ? 1 : 0);
    }
    if (data.isActive !== undefined) {
      updates.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }

    if (updates.length === 0) return;

    params.push(id);
    await execute(
      `UPDATE medications SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  },

  /**
   * Decrement stock count
   */
  async decrementStock(id: string, amount: number = 1): Promise<void> {
    await execute(
      'UPDATE medications SET stock_count = MAX(0, stock_count - ?) WHERE id = ?',
      [amount, id]
    );
  },

  /**
   * Delete a medication
   */
  async delete(id: string): Promise<void> {
    await execute('DELETE FROM medications WHERE id = ?', [id]);
  },
};
