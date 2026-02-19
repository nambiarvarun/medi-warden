import { create } from 'zustand';
import { Profile } from '../types';
import { ProfileRepository } from '../services/database/repositories';

interface ProfileState {
  profiles: Profile[];
  isLoading: boolean;
  error: string | null;
  loadProfiles: () => Promise<void>;
  addProfile: (data: Omit<Profile, 'id' | 'createdAt'>) => Promise<Profile>;
  updateProfile: (id: string, data: Partial<Omit<Profile, 'id' | 'createdAt'>>) => Promise<void>;
  deleteProfile: (id: string) => Promise<void>;
  getProfileById: (id: string) => Profile | undefined;
  reset: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  isLoading: false,
  error: null,

  loadProfiles: async () => {
    set({ isLoading: true, error: null });
    try {
      const profiles = await ProfileRepository.getAll();
      set({ profiles, isLoading: false });
    } catch (error) {
      console.error('Failed to load profiles:', error);
      set({
        error: 'Failed to load profiles',
        isLoading: false,
      });
    }
  },

  addProfile: async (data) => {
    try {
      const profile = await ProfileRepository.create(data);
      set((state) => ({
        profiles: [...state.profiles, profile],
      }));
      return profile;
    } catch (error) {
      console.error('Failed to create profile:', error);
      throw error;
    }
  },

  updateProfile: async (id, data) => {
    try {
      await ProfileRepository.update(id, data);
      set((state) => ({
        profiles: state.profiles.map((p) =>
          p.id === id ? { ...p, ...data } : p
        ),
      }));
    } catch (error) {
      console.error('Failed to update profile:', error);
      throw error;
    }
  },

  deleteProfile: async (id) => {
    try {
      await ProfileRepository.delete(id);
      set((state) => ({
        profiles: state.profiles.filter((p) => p.id !== id),
      }));
    } catch (error) {
      console.error('Failed to delete profile:', error);
      throw error;
    }
  },

  getProfileById: (id) => {
    return get().profiles.find((p) => p.id === id);
  },

  reset: () => {
    set({ profiles: [], isLoading: false, error: null });
  },
}));
