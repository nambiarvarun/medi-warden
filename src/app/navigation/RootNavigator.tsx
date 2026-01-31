import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import { colors } from '../../theme';
import { useSettingsStore } from '../../store/useSettingsStore';

// Screens
import { OnboardingScreen } from '../../screens/onboarding/OnboardingScreen';
import { MainTabs } from './MainTabs';
import { AddMedicationScreen } from '../../screens/medications/AddMedicationScreen';
import { MedicationDetailScreen } from '../../screens/medications/MedicationDetailScreen';
import { EditProfileScreen } from '../../screens/profiles/EditProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function RootNavigator() {
  const { onboardingComplete } = useSettingsStore();

  return (
    <Stack.Navigator
      initialRouteName={onboardingComplete ? 'Main' : 'Onboarding'}
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: colors.white,
        headerTitleStyle: {
          fontWeight: '600',
        },
        contentStyle: {
          backgroundColor: colors.background,
        },
      }}
    >
      <Stack.Screen
        name="Onboarding"
        component={OnboardingScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Main"
        component={MainTabs}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddMedication"
        component={AddMedicationScreen}
        options={({ route }) => ({
          title: route.params?.medicationId ? 'Edit Medication' : 'Add Medication',
          presentation: 'modal',
        })}
      />
      <Stack.Screen
        name="MedicationDetail"
        component={MedicationDetailScreen}
        options={{
          title: 'Medication Details',
        }}
      />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={({ route }) => ({
          title: route.params?.profileId ? 'Edit Profile' : 'Add Profile',
          presentation: 'modal',
        })}
      />
    </Stack.Navigator>
  );
}
