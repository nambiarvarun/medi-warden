# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Medi-Warden is a React Native medicine reminder app that helps users track medications with support for multiple profiles, flexible scheduling, and adherence tracking. Fully local (no backend) using SQLite.

## Common Commands

```bash
npm start              # Start Metro dev server
npm run android        # Build and run on Android
npm run ios            # Build and run on iOS
npm run lint           # Run ESLint
npm test               # Run Jest tests
```

## Architecture

### Layer Overview
```
screens/ → stores/ (Zustand) → repositories/ → SQLite
                ↓
          services/ (notifications, scheduler)
```

### Key Directories
- **src/app/** - App initialization, navigation setup, providers
- **src/services/database/** - SQLite with migrations and repository pattern
- **src/services/notifications/** - Notifee integration for reminders
- **src/services/scheduler/** - Reminder scheduling logic
- **src/store/** - Zustand stores (medications, settings, profiles)
- **src/screens/** - One folder per feature area (home, medications, history, profiles, settings, onboarding)
- **src/components/common/** - Reusable UI components with barrel export

### State Management
Three Zustand stores that interact with repositories:
- `useMedicationStore` - Medications CRUD, stock management
- `useSettingsStore` - App settings, reminder mode, snooze duration, active profile
- `useProfileStore` - Multi-user profile management

### Database Schema
SQLite tables: `profiles`, `medications`, `schedules`, `dose_logs`, `settings`
- Schedules support daily/weekly/interval patterns
- Dose logs track adherence: taken/skipped/missed/pending

### Navigation Structure
- **RootNavigator (Stack)**: Onboarding → Main, plus modals (AddMedication, EditProfile, MedicationDetail)
- **MainTabs (Bottom Tabs)**: Home, Medications, History, Profiles, Settings
- Route determined by `onboardingComplete` setting

### Notification System
Two modes controlled by settings:
- **Strict Mode**: Full-screen alarms with mandatory action
- **Relaxed Mode**: Standard notifications with quick actions

Notification channels: REMINDER, ALARM, REFILL (low stock)
Actions: Take (decrements stock), Skip, Snooze (configurable: 5/10/15/30 min)

Background handlers registered in `index.js`, foreground in `AppProviders.tsx`

### App Initialization Flow
1. `index.js` - Polyfills, background notification handler, app registration
2. `AppProviders` - DB init, notifications, stores, reminder scheduling, loading state
3. `RootNavigator` - Routes based on onboarding status

## Key Patterns

### Adding a Screen
1. Create in `src/screens/[category]/`
2. Add to navigation (RootNavigator or MainTabs)
3. Add param types to `src/app/navigation/types.ts`

### Adding Database Tables
1. Add migration to `src/services/database/migrations.ts`
2. Create repository in `src/services/database/repositories/`
3. Create Zustand store if state needed

### Modifying Notifications
- Notification creation: `NotificationService.ts`
- Scheduling logic: `ReminderScheduler.ts`
- Handlers: `AppProviders.tsx` (foreground) and `index.js` (background)

## Constants
- Database: `mediwarden.db` (version 2)
- Auto-miss timeout: 2 hours
- Snooze options: 5, 10, 15, 30 minutes

## Recent Features (Jan 2026)

### Home Screen Enhancements
- Medications sorted by next intake time (not creation date)
- "Take" and "Skip" buttons on each medication card for in-app dose logging
- Uses `takeMedicationDose()` and `skipMedicationDose()` in `ReminderScheduler.ts`
- Low stock warning hidden for indefinite stock meds

### Indefinite Stock Option
- `isStockIndefinite` field in medications table (migration v2)
- Toggle in AddMedicationScreen hides stock fields when enabled
- Skips stock decrement and refill warnings for indefinite meds
- Stock info hidden in: HomeScreen, MedicationListScreen, MedicationDetailScreen

### Data Persistence
- Android backup enabled with `backup_rules.xml` and `data_extraction_rules.xml`
- Database persists across app updates in `/data/data/com.lynxtech.mediwarden/databases/`

### Key Functions for In-App Dose Actions
- `takeMedicationDose(medicationId)` - Mark dose as taken from UI
- `skipMedicationDose(medicationId)` - Mark dose as skipped from UI
- `DoseLogRepository.getPendingForSchedule()` - Find pending doses for today
