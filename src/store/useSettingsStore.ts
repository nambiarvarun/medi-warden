import { create } from 'zustand';
import { AppSettings, ReminderMode, SnoozeDuration } from '../types';
import { SettingsRepository } from '../services/database/repositories';
import { DEFAULT_SNOOZE_DURATION } from '../utils/constants';
import { scheduleAllReminders, handleProfileSwitch } from '../services/scheduler/ReminderScheduler';

interface SettingsState extends AppSettings {
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  setReminderMode: (mode: ReminderMode) => Promise<void>;
  setSnoozeDuration: (duration: SnoozeDuration) => Promise<void>;
  setSecurityEnabled: (enabled: boolean) => Promise<void>;
  setActiveProfileId: (profileId: string | null) => Promise<void>;
  setOnboardingComplete: (complete: boolean) => Promise<void>;
  reset: () => void;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
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
    const previousMode = get().reminderMode;
    set({ reminderMode: mode });
    await SettingsRepository.set('reminderMode', mode);

    // Full reschedule needed when mode changes (different notification channels/style)
    if (previousMode !== mode) {
      const { activeProfileId } = get();
      if (activeProfileId) {
        console.log(`[SettingsStore] Reminder mode changed ${previousMode} → ${mode}, rescheduling all`);
        await scheduleAllReminders(activeProfileId, mode === 'strict');
      }
    }
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
    const previousProfileId = get().activeProfileId;
    set({ activeProfileId: profileId });
    await SettingsRepository.set('activeProfileId', profileId);

    // Handle profile switch: cancel old profile's notifications, schedule new
    if (previousProfileId !== profileId && profileId) {
      const { reminderMode } = get();
      console.log(`[SettingsStore] Profile switched ${previousProfileId} → ${profileId}, rescheduling`);
      await handleProfileSwitch(previousProfileId, profileId, reminderMode === 'strict');
    }
  },

  setOnboardingComplete: async (complete: boolean) => {
    set({ onboardingComplete: complete });
    await SettingsRepository.set('onboardingComplete', complete);
  },

  reset: () => {
    set({
      reminderMode: 'relaxed',
      snoozeDuration: DEFAULT_SNOOZE_DURATION as SnoozeDuration,
      securityEnabled: false,
      activeProfileId: null,
      onboardingComplete: false,
      isLoading: false,
    });
  },
}));
