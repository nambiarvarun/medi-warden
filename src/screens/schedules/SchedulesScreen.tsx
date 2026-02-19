import React, { useState, useCallback } from 'react';
import { View, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import {
  ScreenWrapper,
  Heading,
  Body,
  Card,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { getPendingNotifications } from '../../services/notifications/NotificationService';

interface GroupedNotification {
  medicationId: string;
  medicationName: string;
  notifications: {
    id: string;
    timestamp: number;
    scheduleId: string;
  }[];
}

export function SchedulesScreen() {
  const [groups, setGroups] = useState<GroupedNotification[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const loadNotifications = useCallback(async () => {
    try {
      const pending = await getPendingNotifications();
      setTotalCount(pending.length);

      // Group by medication
      const groupMap = new Map<string, GroupedNotification>();

      for (const item of pending) {
        const data = item.notification.data;
        const medId = (data?.medicationId as string) || 'unknown';
        const medName = (data?.medicationName as string) || 'Unknown Medication';
        const trigger = item.trigger as { timestamp?: number } | undefined;
        const timestamp = trigger?.timestamp || 0;

        if (!groupMap.has(medId)) {
          groupMap.set(medId, {
            medicationId: medId,
            medicationName: medName,
            notifications: [],
          });
        }

        groupMap.get(medId)!.notifications.push({
          id: item.notification.id || '',
          timestamp,
          scheduleId: (data?.scheduleId as string) || '',
        });
      }

      // Sort notifications within each group by time
      for (const group of groupMap.values()) {
        group.notifications.sort((a, b) => a.timestamp - b.timestamp);
      }

      // Sort groups by earliest notification time
      const sorted = Array.from(groupMap.values()).sort((a, b) => {
        const aFirst = a.notifications[0]?.timestamp || 0;
        const bFirst = b.notifications[0]?.timestamp || 0;
        return aFirst - bFirst;
      });

      setGroups(sorted);
    } catch (error) {
      console.error('[Schedules] Failed to load notifications:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications();
    setRefreshing(false);
  }, [loadNotifications]);

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday =
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth() &&
      date.getDate() === now.getDate();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow =
      date.getFullYear() === tomorrow.getFullYear() &&
      date.getMonth() === tomorrow.getMonth() &&
      date.getDate() === tomorrow.getDate();

    const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (isToday) return `Today ${timeStr}`;
    if (isTomorrow) return `Tomorrow ${timeStr}`;
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} ${timeStr}`;
  };

  const renderGroup = ({ item }: { item: GroupedNotification }) => (
    <Card variant="outlined" style={styles.groupCard}>
      <View style={styles.groupHeader}>
        <Body variant="titleSmall">{item.medicationName}</Body>
        <Body variant="labelMedium" color={colors.text.secondary}>
          {item.notifications.length} scheduled
        </Body>
      </View>
      {item.notifications.map((notif) => (
        <View key={notif.id} style={styles.notifRow}>
          <Body variant="bodySmall" color={colors.text.secondary}>
            {formatTime(notif.timestamp)}
          </Body>
          <Body variant="bodySmall" color={colors.gray[400]} style={styles.notifId}>
            {notif.id.substring(0, 30)}...
          </Body>
        </View>
      ))}
    </Card>
  );

  return (
    <ScreenWrapper scrollable={false}>
      <Heading style={styles.heading}>Scheduled Notifications</Heading>
      <Body variant="bodySmall" color={colors.text.secondary} style={styles.subtitle}>
        {totalCount} total trigger notification{totalCount !== 1 ? 's' : ''} in Notifee
      </Body>

      <FlatList
        data={groups}
        keyExtractor={(item) => item.medicationId}
        renderItem={renderGroup}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={
          <Card variant="filled" style={styles.emptyCard}>
            <Body variant="bodyMedium" color={colors.text.secondary} style={styles.emptyText}>
              No scheduled notifications found.
            </Body>
            <Body variant="bodySmall" color={colors.text.secondary}>
              Notifications are scheduled when you add medications.
            </Body>
          </Card>
        }
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  heading: {
    marginBottom: spacing.xs,
  },
  subtitle: {
    marginBottom: spacing.md,
  },
  list: {
    paddingBottom: spacing.xl,
  },
  groupCard: {
    marginBottom: spacing.sm,
  },
  groupHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  notifRow: {
    paddingVertical: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.gray[100],
  },
  notifId: {
    marginTop: 2,
    fontSize: 10,
  },
  emptyCard: {
    alignItems: 'center',
    padding: spacing.xl,
  },
  emptyText: {
    marginBottom: spacing.xs,
  },
});
