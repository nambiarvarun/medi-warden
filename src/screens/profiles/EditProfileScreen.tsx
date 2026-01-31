import React, { useState, useEffect } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import {
  ScreenWrapper,
  Input,
  Button,
  ColorPicker,
  Body,
  Card,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { useProfileStore, useSettingsStore } from '../../store';
import { RootStackParamList } from '../../app/navigation/types';

type EditProfileRouteProp = RouteProp<RootStackParamList, 'EditProfile'>;

// Profile colors for avatars
const profileColors = [
  colors.primary,
  colors.secondary,
  colors.accent,
  '#E57373',
  '#FFB74D',
  '#81C784',
  '#64B5F6',
  '#BA68C8',
];

export function EditProfileScreen() {
  const navigation = useNavigation();
  const route = useRoute<EditProfileRouteProp>();
  const { addProfile, updateProfile, deleteProfile, getProfileById } =
    useProfileStore();
  const { activeProfileId, setActiveProfileId } = useSettingsStore();

  const isEditing = !!route.params?.profileId;
  const existingProfile = isEditing
    ? getProfileById(route.params.profileId!)
    : null;

  const [name, setName] = useState(existingProfile?.name || '');
  const [avatarColor, setAvatarColor] = useState(
    existingProfile?.avatarColor || profileColors[0]
  );
  const [isCaretaker, setIsCaretaker] = useState(
    existingProfile?.isCaretaker || false
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      if (isEditing && route.params?.profileId) {
        await updateProfile(route.params.profileId, {
          name: name.trim(),
          avatarColor,
          isCaretaker,
        });
      } else {
        const profile = await addProfile({
          name: name.trim(),
          avatarColor,
          isCaretaker,
        });
        // Auto-select new profile if none selected
        if (!activeProfileId) {
          await setActiveProfileId(profile.id);
        }
      }
      navigation.goBack();
    } catch (err) {
      setError('Failed to save profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!route.params?.profileId) return;

    Alert.alert(
      'Delete Profile',
      'Are you sure you want to delete this profile? All associated medications and history will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await deleteProfile(route.params.profileId!);
            // If deleted active profile, clear selection
            if (activeProfileId === route.params.profileId) {
              await setActiveProfileId(null);
            }
            navigation.goBack();
          },
        },
      ]
    );
  };

  return (
    <ScreenWrapper>
      <View style={styles.avatarPreview}>
        <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
          <Body variant="displaySmall" color={colors.white}>
            {name ? name.charAt(0).toUpperCase() : '?'}
          </Body>
        </View>
      </View>

      <Input
        label="Name"
        value={name}
        onChangeText={(text) => {
          setName(text);
          setError('');
        }}
        placeholder="Enter name"
        error={error}
      />

      <View style={styles.colorSection}>
        <Body variant="labelLarge" style={styles.label}>
          Avatar Color
        </Body>
        <View style={styles.colorGrid}>
          {profileColors.map((color) => (
            <View
              key={color}
              style={[
                styles.colorOption,
                { backgroundColor: color },
                avatarColor === color && styles.selectedColor,
              ]}
              onTouchEnd={() => setAvatarColor(color)}
            />
          ))}
        </View>
      </View>

      <Card
        variant={isCaretaker ? 'elevated' : 'outlined'}
        style={styles.caretakerCard}
        onPress={() => setIsCaretaker(!isCaretaker)}
      >
        <View style={styles.caretakerRow}>
          <View style={styles.caretakerInfo}>
            <Body variant="titleSmall">Caretaker Mode</Body>
            <Body variant="bodySmall" color={colors.text.secondary}>
              Enable to receive notifications for all family members
            </Body>
          </View>
          <View
            style={[
              styles.toggle,
              isCaretaker && styles.toggleActive,
            ]}
          >
            <View
              style={[
                styles.toggleThumb,
                isCaretaker && styles.toggleThumbActive,
              ]}
            />
          </View>
        </View>
      </Card>

      <View style={styles.actions}>
        <Button
          title={isEditing ? 'Save Changes' : 'Create Profile'}
          onPress={handleSubmit}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
        />
        {isEditing && (
          <Button
            title="Delete Profile"
            onPress={handleDelete}
            variant="ghost"
            fullWidth
            textStyle={{ color: colors.error }}
            style={styles.deleteButton}
          />
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  avatarPreview: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSection: {
    marginBottom: spacing.lg,
  },
  label: {
    marginBottom: spacing.sm,
    color: colors.text.primary,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  colorOption: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedColor: {
    borderColor: colors.text.primary,
    borderWidth: 3,
  },
  caretakerCard: {
    marginBottom: spacing.lg,
  },
  caretakerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  caretakerInfo: {
    flex: 1,
  },
  toggle: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.gray[300],
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: colors.primary,
  },
  toggleThumb: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.white,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  actions: {
    marginTop: spacing.lg,
  },
  deleteButton: {
    marginTop: spacing.sm,
  },
});
