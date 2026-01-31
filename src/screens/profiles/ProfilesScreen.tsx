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
import { useSettingsStore, useProfileStore } from '../../store';
import { Profile } from '../../types';

export function ProfilesScreen() {
  const navigation = useNavigation();
  const { activeProfileId, setActiveProfileId } = useSettingsStore();
  const { profiles, loadProfiles, isLoading } = useProfileStore();

  useEffect(() => {
    loadProfiles();
  }, []);

  const handleSelectProfile = async (profileId: string) => {
    await setActiveProfileId(profileId);
  };

  const renderProfile = ({ item }: { item: Profile }) => {
    const isActive = item.id === activeProfileId;

    return (
      <Card
        style={isActive ? [styles.profileCard, styles.activeCard] : styles.profileCard}
        onPress={() => handleSelectProfile(item.id)}
      >
        <View style={styles.profileHeader}>
          <View
            style={[styles.avatar, { backgroundColor: item.avatarColor }]}
          >
            <Body variant="titleLarge" color={colors.white}>
              {item.name.charAt(0).toUpperCase()}
            </Body>
          </View>
          <View style={styles.profileInfo}>
            <Body variant="titleMedium">{item.name}</Body>
            {item.isCaretaker && (
              <Body variant="labelSmall" color={colors.secondary}>
                Caretaker
              </Body>
            )}
          </View>
          {isActive && (
            <View style={styles.activeBadge}>
              <Body variant="labelSmall" color={colors.white}>
                Active
              </Body>
            </View>
          )}
        </View>
        <View style={styles.profileActions}>
          <Button
            title="Edit"
            variant="ghost"
            size="small"
            onPress={() =>
              navigation.navigate('EditProfile', { profileId: item.id })
            }
          />
        </View>
      </Card>
    );
  };

  return (
    <ScreenWrapper scrollable={false} padded={false}>
      <View style={styles.header}>
        <Heading>Profiles</Heading>
        <Body color={colors.text.secondary}>
          Manage family members' medications
        </Body>
      </View>

      {isLoading ? (
        <Loading message="Loading profiles..." />
      ) : profiles.length === 0 ? (
        <EmptyState
          title="No Profiles"
          message="Create your first profile to start tracking medications."
          actionLabel="Add Profile"
          onAction={() => navigation.navigate('EditProfile', {})}
        />
      ) : (
        <FlatList
          data={profiles}
          renderItem={renderProfile}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      <View style={styles.footer}>
        <Button
          title="Add New Profile"
          onPress={() => navigation.navigate('EditProfile', {})}
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
    paddingTop: spacing.sm,
  },
  profileCard: {
    marginBottom: spacing.sm,
  },
  activeCard: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  profileInfo: {
    flex: 1,
  },
  activeBadge: {
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: spacing.borderRadius.sm,
  },
  profileActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  footer: {
    padding: spacing.screenHorizontal,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.gray[200],
    backgroundColor: colors.surface,
  },
});
