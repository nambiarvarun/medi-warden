import { v4 as uuidv4 } from 'uuid';
import { query, execute } from '../index';
import { Profile } from '../../../types';

interface ProfileRow {
  id: string;
  name: string;
  is_caretaker: number;
  avatar_color: string | null;
  created_at: number;
}

function mapRowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    name: row.name,
    isCaretaker: row.is_caretaker === 1,
    avatarColor: row.avatar_color || '#629FAD',
    createdAt: row.created_at,
  };
}

export const ProfileRepository = {
  /**
   * Get all profiles
   */
  async getAll(): Promise<Profile[]> {
    const rows = await query<ProfileRow>(
      'SELECT * FROM profiles ORDER BY created_at ASC'
    );
    return rows.map(mapRowToProfile);
  },

  /**
   * Get a profile by ID
   */
  async getById(id: string): Promise<Profile | null> {
    const rows = await query<ProfileRow>(
      'SELECT * FROM profiles WHERE id = ?',
      [id]
    );
    return rows.length > 0 ? mapRowToProfile(rows[0]) : null;
  },

  /**
   * Get the caretaker profile (if any)
   */
  async getCaretaker(): Promise<Profile | null> {
    const rows = await query<ProfileRow>(
      'SELECT * FROM profiles WHERE is_caretaker = 1 LIMIT 1'
    );
    return rows.length > 0 ? mapRowToProfile(rows[0]) : null;
  },

  /**
   * Create a new profile
   */
  async create(
    data: Omit<Profile, 'id' | 'createdAt'>
  ): Promise<Profile> {
    const id = uuidv4();
    const createdAt = Date.now();

    await execute(
      `INSERT INTO profiles (id, name, is_caretaker, avatar_color, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [id, data.name, data.isCaretaker ? 1 : 0, data.avatarColor, createdAt]
    );

    return {
      id,
      createdAt,
      ...data,
    };
  },

  /**
   * Update a profile
   */
  async update(
    id: string,
    data: Partial<Omit<Profile, 'id' | 'createdAt'>>
  ): Promise<void> {
    const updates: string[] = [];
    const params: (string | number | null)[] = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.isCaretaker !== undefined) {
      updates.push('is_caretaker = ?');
      params.push(data.isCaretaker ? 1 : 0);
    }
    if (data.avatarColor !== undefined) {
      updates.push('avatar_color = ?');
      params.push(data.avatarColor);
    }

    if (updates.length === 0) return;

    params.push(id);
    await execute(
      `UPDATE profiles SET ${updates.join(', ')} WHERE id = ?`,
      params
    );
  },

  /**
   * Delete a profile and all associated data
   */
  async delete(id: string): Promise<void> {
    await execute('DELETE FROM profiles WHERE id = ?', [id]);
  },

  /**
   * Get the count of profiles
   */
  async getCount(): Promise<number> {
    const rows = await query<{ count: number }>(
      'SELECT COUNT(*) as count FROM profiles'
    );
    return rows[0]?.count || 0;
  },
};
