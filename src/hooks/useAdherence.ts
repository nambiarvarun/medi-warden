import { useState, useEffect, useCallback } from 'react';
import { DoseLogRepository } from '../services/database/repositories';
import { AdherenceStats } from '../types';
import { useSettingsStore } from '../store';

export function useAdherence(
  medicationId?: string,
  startDate?: Date,
  endDate?: Date
) {
  const { activeProfileId } = useSettingsStore();
  const [stats, setStats] = useState<AdherenceStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = useCallback(async () => {
    if (!activeProfileId && !medicationId) {
      setStats(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let adherenceStats: AdherenceStats;

      if (medicationId) {
        adherenceStats = await DoseLogRepository.getMedicationAdherenceStats(
          medicationId,
          startDate?.getTime(),
          endDate?.getTime()
        );
      } else if (activeProfileId) {
        adherenceStats = await DoseLogRepository.getAdherenceStats(
          activeProfileId,
          startDate?.getTime(),
          endDate?.getTime()
        );
      } else {
        throw new Error('No profile or medication specified');
      }

      setStats(adherenceStats);
    } catch (err) {
      console.error('Failed to load adherence stats:', err);
      setError('Failed to load statistics');
    } finally {
      setIsLoading(false);
    }
  }, [activeProfileId, medicationId, startDate, endDate]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return {
    stats,
    isLoading,
    error,
    refresh: loadStats,
  };
}

// Helper hook for weekly adherence
export function useWeeklyAdherence(medicationId?: string) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  return useAdherence(medicationId, startDate, endDate);
}

// Helper hook for monthly adherence
export function useMonthlyAdherence(medicationId?: string) {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setMonth(startDate.getMonth() - 1);

  return useAdherence(medicationId, startDate, endDate);
}
