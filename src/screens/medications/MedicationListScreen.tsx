import React, { useEffect } from 'react';
import { View, FlatList, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ScreenWrapper,
  Heading,
  Body,
  Card,
  Button,
  EmptyState,
  Loading,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { useSettingsStore, useMedicationStore } from '../../store';
import { Medication } from '../../types';

export function MedicationListScreen() {
  const navigation = useNavigation();
  const { activeProfileId } = useSettingsStore();
  const { medications, loadMedications, isLoading } = useMedicationStore();

  useEffect(() => {
    if (activeProfileId) {
      loadMedications(activeProfileId);
    }
  }, [activeProfileId]);

  const renderMedication = ({ item }: { item: Medication }) => (
    <Card
      style={styles.card}
      onPress={() =>
        navigation.navigate('MedicationDetail', { medicationId: item.id })
      }
    >
      <View style={styles.cardHeader}>
        <View style={[styles.colorDot, { backgroundColor: item.color }]} />
        <View style={styles.cardInfo}>
          <Body variant="titleMedium">{item.name}</Body>
          {item.dosage && (
            <Body color={colors.text.secondary} variant="bodySmall">
              {item.dosage}
            </Body>
          )}
        </View>
        {!item.isStockIndefinite && (
          <View style={styles.stockBadge}>
            <Body
              variant="labelSmall"
              color={
                item.stockCount <= item.stockReminderThreshold
                  ? colors.warning
                  : colors.text.secondary
              }
            >
              {item.stockCount} left
            </Body>
          </View>
        )}
      </View>
      {item.notes && (
        <Body color={colors.text.secondary} variant="bodySmall" numberOfLines={2}>
          {item.notes}
        </Body>
      )}
      {!item.isActive && (
        <Body color={colors.gray[500]} variant="labelSmall">
          Inactive
        </Body>
      )}
    </Card>
  );

  if (!activeProfileId) {
    return (
      <ScreenWrapper>
        <EmptyState
          title="No Profile Selected"
          message="Please select a profile to view medications."
        />
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper scrollable={false} padded={false}>
      <View style={styles.header}>
        <Heading>Medications</Heading>
      </View>

      {isLoading ? (
        <Loading message="Loading medications..." />
      ) : medications.length === 0 ? (
        <EmptyState
          title="No Medications"
          message="Add your first medication to start tracking."
          actionLabel="Add Medication"
          onAction={() => navigation.navigate('AddMedication', {})}
        />
      ) : (
        <FlatList
          data={medications}
          renderItem={renderMedication}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.footer}>
        <Button
          title="Add Medication"
          onPress={() => navigation.navigate('AddMedication', {})}
          fullWidth
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: {
    padding: spacing.screenHorizontal,
    paddingBottom: spacing.sm,
  },
  list: {
    padding: spacing.screenHorizontal,
    paddingTop: 0,
  },
  card: {
    marginBottom: spacing.sm,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  colorDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: spacing.sm,
  },
  cardInfo: {
    flex: 1,
  },
  stockBadge: {
    backgroundColor: colors.gray[100],
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.sm,
  },
  footer: {
    padding: spacing.screenHorizontal,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.surface,
  },
});
