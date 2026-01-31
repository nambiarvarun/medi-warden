import { create } from 'zustand';
import { AppSettings, ReminderMode, SnoozeDuration } from '../types';
import { SettingsRepository } from '../services/database/repositories';
import { DEFAULT_SNOOZE_DURATION } from '../utils/constants';

interface SettingsState extends AppSettings {
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setReminderMode: (mode: ReminderMode) => Promise<void>;
  setSnoozeDuration: (duration: SnoozeDuration) => Promise<void>;
  setSecurityEnabled: (enabled: boolean) => Promise<void>;
  setActiveProfileId: (profileId: string | null) => Promise<void>;
  setOnboardingComplete: (complete: boolean) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, _get) => ({
  // Default state
  reminderMode: 'relaxed',
  snoozeDuration: DEFAULT_SNOOZE_DURATION as SnoozeDuration,
  securityEnabled: false,
  activeProfileId: null,
  onboardingComplete: false,
  isLoading: true,

  loadSettings: async () => {
    try {
      const settings = await SettingsRepository.getAll();
      set({ ...settings, isLoading: false });
    } catch (error) {
      console.error('Failed to load settings:', error);
      set({ isLoading: false });
    }
  },

  setReminderMode: async (mode: ReminderMode) => {
    set({ reminderMode: mode });
    await SettingsRepository.set('reminderMode', mode);
  },

  setSnoozeDuration: async (duration: SnoozeDuration) => {
    set({ snoozeDuration: duration });
    await SettingsRepository.set('snoozeDuration', duration);
  },

  setSecurityEnabled: async (enabled: boolean) => {
    set({ securityEnabled: enabled });
    await SettingsRepository.set('securityEnabled', enabled);
  },

  setActiveProfileId: async (profileId: string | null) => {
    set({ activeProfileId: profileId });
    await SettingsRepository.set('activeProfileId', profileId);
  },

  setOnboardingComplete: async (complete: boolean) => {
    set({ onboardingComplete: complete });
    await SettingsRepository.set('onboardingComplete', complete);
  },
}));
