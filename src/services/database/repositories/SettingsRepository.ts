import { query, execute } from '../index';
import { AppSettings, ReminderMode, SnoozeDuration } from '../../../types';
import { DEFAULT_SNOOZE_DURATION } from '../../../utils/constants';

const DEFAULT_SETTINGS: AppSettings = {
  reminderMode: 'relaxed',
  snoozeDuration: DEFAULT_SNOOZE_DURATION as SnoozeDuration,
  securityEnabled: false,
  activeProfileId: null,
  onboardingComplete: false,
};

export const SettingsRepository = {
  /**
   * Get a setting value
   */
  async get<T>(key: string, defaultValue: T): Promise<T> {
    const rows = await query<{ value: string }>(
      'SELECT value FROM settings WHERE key = ?',
      [key]
    );
    if (rows.length === 0) {
      return defaultValue;
    }
    try {
      return JSON.parse(rows[0].value) as T;
    } catch {
      return rows[0].value as T;
    }
  },

  /**
   * Set a setting value
   */
  async set(key: string, value: unknown): Promise<void> {
    const stringValue =
      typeof value === 'string' ? value : JSON.stringify(value);
    await execute(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
      [key, stringValue]
    );
  },

  /**
   * Get all app settings
   */
  async getAll(): Promise<AppSettings> {
    const [
      reminderMode,
      snoozeDuration,
      securityEnabled,
      activeProfileId,
      onboardingComplete,
    ] = await Promise.all([
      this.get<ReminderMode>('reminderMode', DEFAULT_SETTINGS.reminderMode),
      this.get<SnoozeDuration>('snoozeDuration', DEFAULT_SETTINGS.snoozeDuration),
      this.get<boolean>('securityEnabled', DEFAULT_SETTINGS.securityEnabled),
      this.get<string | null>('activeProfileId', DEFAULT_SETTINGS.activeProfileId),
      this.get<boolean>('onboardingComplete', DEFAULT_SETTINGS.onboardingComplete),
    ]);

    return {
      reminderMode,
      snoozeDuration,
      securityEnabled,
      activeProfileId,
      onboardingComplete,
    };
  },

  /**
   * Save all app settings
   */
  async saveAll(settings: Partial<AppSettings>): Promise<void> {
    const promises: Promise<void>[] = [];

    if (settings.reminderMode !== undefined) {
      promises.push(this.set('reminderMode', settings.reminderMode));
    }
    if (settings.snoozeDuration !== undefined) {
      promises.push(this.set('snoozeDuration', settings.snoozeDuration));
    }
    if (settings.securityEnabled !== undefined) {
      promises.push(this.set('securityEnabled', settings.securityEnabled));
    }
    if (settings.activeProfileId !== undefined) {
      promises.push(this.set('activeProfileId', settings.activeProfileId));
    }
    if (settings.onboardingComplete !== undefined) {
      promises.push(this.set('onboardingComplete', settings.onboardingComplete));
    }

    await Promise.all(promises);
  },

  /**
   * Reset settings to defaults
   */
  async reset(): Promise<void> {
    await this.saveAll(DEFAULT_SETTINGS);
  },
};
