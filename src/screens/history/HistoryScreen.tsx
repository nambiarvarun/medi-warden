import React, { useEffect, useState, useCallback } from 'react';
import { View, FlatList, StyleSheet, SectionList } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ScreenWrapper,
  Heading,
  Body,
  Card,
  EmptyState,
  Loading,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { useSettingsStore, useMedicationStore } from '../../store';
import { DoseLogRepository, MedicationRepository } from '../../services/database/repositories';
import { DoseLog, AdherenceStats, Medication } from '../../types';
import { formatDateTime, formatDate } from '../../utils/dateUtils';

interface MedicationAdherence {
  medication: Medication;
  stats: AdherenceStats;
}

export function HistoryScreen() {
  const { activeProfileId } = useSettingsStore();
  const { medications, loadMedications } = useMedicationStore();

  const [logs, setLogs] = useState<DoseLog[]>([]);
  const [medicationStats, setMedicationStats] = useState<MedicationAdherence[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (!activeProfileId) return;

    setIsLoading(true);
    try {
      // Get current time with small buffer for recently taken doses
      const now = Date.now() + 1000; // 1 second buffer

      // Load logs up to current time only (no future pending doses)
      const logsData = await DoseLogRepository.getByProfileId(
        activeProfileId,
        undefined, // no start date filter
        now // end at current time (with buffer)
      );

      // Filter out pending doses (only show taken, skipped, missed)
      const pastLogs = logsData.filter(log => log.status !== 'pending');
      setLogs(pastLogs);

      // Load per-medication adherence stats (use same time window)
      const meds = await MedicationRepository.getByProfileId(activeProfileId);
      const statsPromises = meds.map(async (med) => {
        const stats = await DoseLogRepository.getMedicationAdherenceStats(med.id, undefined, now);
        return { medication: med, stats };
      });

      const allStats = await Promise.all(statsPromises);
      // Only show medications that have some history
      const statsWithHistory = allStats.filter(s => s.stats.totalDoses > 0);
      setMedicationStats(statsWithHistory);
    } catch (error) {
      console.error('Failed to load history:', error);
    } finally {
      setIsLoading(false);
    }
  }, [activeProfileId]);

  useEffect(() => {
    if (activeProfileId) {
      loadMedications(activeProfileId);
    }
  }, [activeProfileId]);

  // Reload when screen comes into focus - always fetch fresh data
  useFocusEffect(
    useCallback(() => {
      if (activeProfileId) {
        loadData();
      }
    }, [activeProfileId]) // eslint-disable-line react-hooks/exhaustive-deps
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'taken':
        return colors.success;
      case 'skipped':
        return colors.warning;
      case 'missed':
        return colors.error;
      default:
        return colors.gray[500];
    }
  };

  const getMedicationById = (id: string) => {
    return medications.find(m => m.id === id);
  };

  const renderMedicationStats = ({ item }: { item: MedicationAdherence }) => {
    const { medication, stats } = item;

    return (
      <Card style={styles.medicationStatsCard}>
        <View style={styles.medicationHeader}>
          <View style={[styles.colorDot, { backgroundColor: medication.color }]} />
          <Body variant="titleMedium" style={styles.medicationName}>
            {medication.name}
          </Body>
          <Body variant="titleLarge" color={colors.primary}>
            {stats.adherencePercentage}%
          </Body>
        </View>
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Body variant="labelLarge" color={colors.success}>
              {stats.takenDoses}
            </Body>
            <Body variant="labelSmall" color={colors.text.secondary}>
              Taken
            </Body>
          </View>
          <View style={styles.statItem}>
            <Body variant="labelLarge" color={colors.warning}>
              {stats.skippedDoses}
            </Body>
            <Body variant="labelSmall" color={colors.text.secondary}>
              Skipped
            </Body>
          </View>
          <View style={styles.statItem}>
            <Body variant="labelLarge" color={colors.error}>
              {stats.missedDoses}
            </Body>
            <Body variant="labelSmall" color={colors.text.secondary}>
              Missed
            </Body>
          </View>
          <View style={styles.statItem}>
            <Body variant="labelLarge" color={colors.text.secondary}>
              {stats.totalDoses}
            </Body>
            <Body variant="labelSmall" color={colors.text.secondary}>
              Total
            </Body>
          </View>
        </View>
      </Card>
    );
  };

  const renderLog = ({ item }: { item: DoseLog }) => {
    const medication = getMedicationById(item.medicationId);

    return (
      <Card variant="outlined" style={styles.logCard}>
        <View style={styles.logHeader}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusColor(item.status) },
            ]}
          />
          <View style={styles.logInfo}>
            <Body variant="titleSmall">
              {medication?.name || 'Unknown Medication'}
            </Body>
            <Body variant="bodySmall" color={colors.text.secondary}>
              {formatDateTime(item.scheduledTime)}
            </Body>
          </View>
          <Body
            variant="labelSmall"
            color={getStatusColor(item.status)}
            style={styles.statusLabel}
          >
            {item.status.toUpperCase()}
          </Body>
        </View>
      </Card>
    );
  };

  if (!activeProfileId) {
    return (
      <ScreenWrapper>
        <EmptyState
          title="No Profile Selected"
          message="Please select a profile to view history."
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scrollable={false} padded={false}>
      <View style={styles.header}>
        <Heading>History</Heading>
      </View>

      {isLoading ? (
        <Loading message="Loading history..." />
      ) : (
        <>
          {medicationStats.length > 0 && (
            <View style={styles.statsContainer}>
              <Body variant="titleMedium" style={styles.sectionTitle}>
                Adherence by Medication
              </Body>
              <FlatList
                data={medicationStats}
                renderItem={renderMedicationStats}
                keyExtractor={(item) => item.medication.id}
                horizontal={false}
                scrollEnabled={false}
              />
            </View>
          )}

          <View style={styles.logsSection}>
            <Body variant="titleMedium" style={styles.sectionTitle}>
              Recent Activity
            </Body>

            {logs.length === 0 ? (
              <EmptyState
                title="No History Yet"
                message="Your medication history will appear here once you start taking your medications."
              />
            ) : (
              <FlatList
                data={logs}
                renderItem={renderLog}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
              />
            )}
          </View>
        </>
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.screenHorizontal,
    paddingBottom: spacing.sm,
  },
  statsContainer: {
    paddingHorizontal: spacing.screenHorizontal,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    marginBottom: spacing.sm,
  },
  medicationStatsCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  medicationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: spacing.sm,
  },
  medicationName: {
    flex: 1,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  logsSection: {
    flex: 1,
    paddingHorizontal: spacing.screenHorizontal,
  },
  list: {
    paddingTop: 0,
    paddingBottom: spacing.xl,
  },
  logCard: {
    marginBottom: spacing.xs,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: spacing.sm,
  },
  logInfo: {
    flex: 1,
  },
  statusLabel: {
    textTransform: 'uppercase',
  },
});
