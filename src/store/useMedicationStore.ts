import { create } from 'zustand';
import { Medication, Schedule, MedicationWithSchedule } from '../types';
import {
  MedicationRepository,
  ScheduleRepository,
} from '../services/database/repositories';
import { scheduleMedicationReminders } from '../services/scheduler/ReminderScheduler';
import { useSettingsStore } from './useSettingsStore';

interface MedicationState {
  medications: Medication[];
  isLoading: boolean;
  error: string | null;
  loadMedications: (profileId: string) => Promise<void>;
  getMedicationWithSchedules: (id: string) => Promise<MedicationWithSchedule | null>;
  addMedication: (
    data: Omit<Medication, 'id' | 'createdAt'>,
    schedules?: Omit<Schedule, 'id' | 'medicationId'>[]
  ) => Promise<Medication>;
  updateMedication: (
    id: string,
    data: Partial<Omit<Medication, 'id' | 'profileId' | 'createdAt'>>
  ) => Promise<void>;
  updateMedicationWithSchedules: (
    id: string,
    data: Partial<Omit<Medication, 'id' | 'profileId' | 'createdAt'>>,
    schedules: Omit<Schedule, 'id' | 'medicationId'>[]
  ) => Promise<void>;
  deleteMedication: (id: string) => Promise<void>;
  decrementStock: (id: string) => Promise<void>;
  getMedicationById: (id: string) => Medication | undefined;
  getLowStockMedications: (profileId: string) => Promise<Medication[]>;
}

export const useMedicationStore = create<MedicationState>((set, get) => ({
  medications: [],
  isLoading: false,
  error: null,

  loadMedications: async (profileId: string) => {
    set({ isLoading: true, error: null });
    try {
      const medications = await MedicationRepository.getByProfileId(profileId);
      set({ medications, isLoading: false });
    } catch (error) {
      console.error('Failed to load medications:', error);
      set({
        error: 'Failed to load medications',
        isLoading: false,
      });
    }
  },

  getMedicationWithSchedules: async (id: string) => {
    try {
      const medication = await MedicationRepository.getById(id);
      if (!medication) return null;

      const schedules = await ScheduleRepository.getByMedicationId(id);
      return { ...medication, schedules };
    } catch (error) {
      console.error('Failed to get medication with schedules:', error);
      return null;
    }
  },

  addMedication: async (data, schedules = []) => {
    try {
      const medication = await MedicationRepository.create(data);

      // Create schedules for the medication
      const createdSchedules: Schedule[] = [];
      for (const scheduleData of schedules) {
        const schedule = await ScheduleRepository.create({
          ...scheduleData,
          medicationId: medication.id,
        });
        createdSchedules.push(schedule);
      }

      set((state) => ({
        medications: [medication, ...state.medications],
      }));

      // Schedule notifications for this medication
      const { reminderMode } = useSettingsStore.getState();
      await scheduleMedicationReminders(
        medication,
        createdSchedules,
        reminderMode === 'strict'
      );

      return medication;
    } catch (error) {
      console.error('Failed to create medication:', error);
      throw error;
    }
  },

  updateMedication: async (id, data) => {
    try {
      await MedicationRepository.update(id, data);
      set((state) => ({
        medications: state.medications.map((m) =>
          m.id === id ? { ...m, ...data } : m
        ),
      }));
    } catch (error) {
      console.error('Failed to update medication:', error);
      throw error;
    }
  },

  updateMedicationWithSchedules: async (id, data, schedules) => {
    try {
      // Update medication
      await MedicationRepository.update(id, data);

      // Delete existing schedules and create new ones
      await ScheduleRepository.deleteByMedicationId(id);
      const createdSchedules: Schedule[] = [];
      for (const scheduleData of schedules) {
        const schedule = await ScheduleRepository.create({
          ...scheduleData,
          medicationId: id,
        });
        createdSchedules.push(schedule);
      }

      // Get the updated medication
      const updatedMedication = await MedicationRepository.getById(id);

      set((state) => ({
        medications: state.medications.map((m) =>
          m.id === id ? { ...m, ...data } : m
        ),
      }));

      // Reschedule notifications for this medication
      if (updatedMedication) {
        const { reminderMode } = useSettingsStore.getState();
        await scheduleMedicationReminders(
          updatedMedication,
          createdSchedules,
          reminderMode === 'strict'
        );
      }
    } catch (error) {
      console.error('Failed to update medication with schedules:', error);
      throw error;
    }
  },

  deleteMedication: async (id) => {
    try {
      await MedicationRepository.delete(id);
      set((state) => ({
        medications: state.medications.filter((m) => m.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete medication:', error);
      throw error;
    }
  },

  decrementStock: async (id) => {
    try {
      await MedicationRepository.decrementStock(id);
      set((state) => ({
        medications: state.medications.map((m) =>
          m.id === id ? { ...m, stockCount: Math.max(0, m.stockCount - 1) } : m
        ),
      }));
    } catch (error) {
      console.error('Failed to decrement stock:', error);
      throw error;
    }
  },

  getMedicationById: (id) => {
    return get().medications.find((m) => m.id === id);
  },

  getLowStockMedications: async (profileId: string) => {
    try {
      return await MedicationRepository.getLowStock(profileId);
    } catch (error) {
      console.error('Failed to get low stock medications:', error);
      return [];
    }
  },
}));
