import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  ScreenWrapper,
  Heading,
  Body,
  Button,
  Card,
  Input,
} from '../../components/common';
import { colors, spacing } from '../../theme';
import { useSettingsStore, useProfileStore } from '../../store';
import { ReminderMode } from '../../types';

type OnboardingStep = 'welcome' | 'reminder-mode' | 'create-profile';

export function OnboardingScreen() {
  const navigation = useNavigation();
  const { setReminderMode, setOnboardingComplete, setActiveProfileId } =
    useSettingsStore();
  const { addProfile } = useProfileStore();

  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [selectedMode, setSelectedMode] = useState<ReminderMode>('relaxed');
  const [profileName, setProfileName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleModeSelect = (mode: ReminderMode) => {
    setSelectedMode(mode);
  };

  const handleContinueFromMode = async () => {
    await setReminderMode(selectedMode);
    setStep('create-profile');
  };

  const handleFinish = async () => {
    if (!profileName.trim()) {
      setError('Please enter your name');
      return;
    }

    setIsSubmitting(true);
    setError('');

    try {
      const profile = await addProfile({
        name: profileName.trim(),
        avatarColor: colors.primary,
        isCaretaker: false,
      });

      await setActiveProfileId(profile.id);
      await setOnboardingComplete(true);

      navigation.reset({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    } catch (err) {
      setError('Failed to create profile. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (step === 'welcome') {
    return (
      <ScreenWrapper safeArea avoidBottomInset>
        <View style={styles.container}>
          <View style={styles.content}>
            <View style={styles.logoContainer}>
              <View style={styles.logo}>
                <Body variant="displayLarge" color={colors.white}>
                  M
                </Body>
              </View>
            </View>
            <Heading style={styles.title}>Welcome to Medi-Warden</Heading>
            <Body
              color={colors.text.secondary}
              style={styles.subtitle}
            >
              Your personal medication reminder assistant. Never miss a dose again.
            </Body>
          </View>
          <Button
            title="Get Started"
            onPress={() => setStep('reminder-mode')}
            fullWidth
            size="large"
          />
        </View>
      </ScreenWrapper>
    );
  }

  if (step === 'reminder-mode') {
    return (
      <ScreenWrapper safeArea avoidBottomInset>
        <View style={styles.container}>
          <View style={styles.content}>
            <Heading style={styles.title}>Choose Reminder Style</Heading>
            <Body color={colors.text.secondary} style={styles.subtitle}>
              How would you like to be reminded about your medications?
            </Body>

            <Card
              style={selectedMode === 'strict' ? [styles.modeCard, styles.selectedCard] : styles.modeCard}
              onPress={() => handleModeSelect('strict')}
            >
              <Body variant="titleMedium">Strict Mode</Body>
              <Body variant="bodySmall" color={colors.text.secondary}>
                Full-screen alarm that appears even when your phone is locked.
                Best for critical medications.
              </Body>
            </Card>

            <Card
              style={selectedMode === 'relaxed' ? [styles.modeCard, styles.selectedCard] : styles.modeCard}
              onPress={() => handleModeSelect('relaxed')}
            >
              <Body variant="titleMedium">Relaxed Mode</Body>
              <Body variant="bodySmall" color={colors.text.secondary}>
                Standard notification that you can dismiss. Best for vitamins
                and supplements.
              </Body>
            </Card>

            <Body variant="bodySmall" color={colors.text.secondary} style={styles.note}>
              You can change this later in Settings
            </Body>
          </View>

          <Button
            title="Continue"
            onPress={handleContinueFromMode}
            fullWidth
            size="large"
          />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper safeArea avoidBottomInset>
      <View style={styles.container}>
        <View style={styles.content}>
          <Heading style={styles.title}>Create Your Profile</Heading>
          <Body color={colors.text.secondary} style={styles.subtitle}>
            What should we call you?
          </Body>

          <Input
            label="Your Name"
            value={profileName}
            onChangeText={(text) => {
              setProfileName(text);
              setError('');
            }}
            placeholder="Enter your name"
            error={error}
            autoFocus
          />

          <Body variant="bodySmall" color={colors.text.secondary} style={styles.note}>
            You can add family members later to manage their medications too
          </Body>
        </View>

        <Button
          title="Finish Setup"
          onPress={handleFinish}
          loading={isSubmitting}
          disabled={isSubmitting}
          fullWidth
          size="large"
        />
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logo: {
    width: 100,
    height: 100,
    borderRadius: 24,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.lg,
  },
  modeCard: {
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  selectedCard: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceVariant,
  },
  note: {
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
