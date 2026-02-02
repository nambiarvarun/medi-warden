// Profile types
export interface Profile {
  id: string;
  name: string;
  isCaretaker: boolean;
  avatarColor: string;
  createdAt: number;
}

// Medication types
export interface Medication {
  id: string;
  profileId: string;
  name: string;
  dosage: string;
  notes: string;
  color: string;
  stockCount: number;
  stockReminderThreshold: number;
  isStockIndefinite: boolean;
  isActive: boolean;
  createdAt: number;
}

// Schedule types
export type ScheduleType = 'daily' | 'weekly' | 'interval';

export interface Schedule {
  id: string;
  medicationId: string;
  scheduleType: ScheduleType;
  timesOfDay: string[]; // Array of times like ["08:00", "20:00"]
  daysOfWeek: number[] | null; // For weekly: [1,3,5] = Mon, Wed, Fri (0=Sun, 6=Sat)
  intervalDays: number | null; // For interval type: every X days
  startDate: number; // Unix timestamp
  endDate: number | null; // Unix timestamp, null for indefinite
  durationDays: number | null; // Alternative to endDate
  isActive: boolean;
}

// Dose log types
export type DoseStatus = 'taken' | 'skipped' | 'missed' | 'pending';

export interface DoseLog {
  id: string;
  medicationId: string;
  scheduleId: string;
  scheduledTime: number; // Unix timestamp
  actionTime: number | null; // When user took action
  status: DoseStatus;
  snoozedUntil: number | null; // Unix timestamp when snooze expires
}

// Settings types
export type ReminderMode = 'strict' | 'relaxed';
export type SnoozeDuration = 5 | 10 | 15 | 30;

export interface AppSettings {
  reminderMode: ReminderMode;
  snoozeDuration: SnoozeDuration;
  securityEnabled: boolean;
  activeProfileId: string | null;
  onboardingComplete: boolean;
}

// Navigation types
export type RootStackParamList = {
  Onboarding: undefined;
  Main: undefined;
  AddMedication: { medicationId?: string };
  MedicationDetail: { medicationId: string };
  EditProfile: { profileId?: string };
};

export type MainTabParamList = {
  Home: undefined;
  Medications: undefined;
  History: undefined;
  Profiles: undefined;
  Settings: undefined;
};

// Reminder/Notification types
export interface ScheduledReminder {
  id: string;
  medicationId: string;
  scheduleId: string;
  scheduledTime: number;
  medicationName: string;
  dosage: string;
  color: string;
}

// Statistics types
export interface AdherenceStats {
  totalDoses: number;
  takenDoses: number;
  skippedDoses: number;
  missedDoses: number;
  adherencePercentage: number;
}

export interface MedicationWithSchedule extends Medication {
  schedules: Schedule[];
}
