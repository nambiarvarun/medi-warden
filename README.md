# Medi-Warden

A React Native medication reminder app for Android and iOS. Medi-Warden helps individuals and caretakers track medications across multiple profiles with flexible scheduling, adherence history, and reliable notifications — all stored locally with no backend or account required.

## Features

- **Multiple profiles** — manage medications for yourself and others (family, patients) from a single app
- **Flexible scheduling** — daily, weekly, or interval-based reminders with multiple times per day
- **Two notification modes** — Strict (full-screen alarm, mandatory action) or Relaxed (standard notification with quick actions)
- **Dose actions** — Take, Skip, or Snooze (5/10/15/30 min) directly from notifications or the home screen
- **Adherence tracking** — per-medication and overall adherence history with taken/skipped/missed logs
- **Stock management** — track remaining doses with configurable low-stock warnings; supports indefinite stock
- **Fully offline** — SQLite database, no account, no network calls, no telemetry
- **Android backup** — database survives app updates and device restores

## Screenshots

> Coming soon

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React Native 0.83 (New Architecture) |
| Language | TypeScript |
| Navigation | React Navigation v7 (Stack + Bottom Tabs) |
| State | Zustand v5 |
| Database | SQLite (`react-native-sqlite-storage`) |
| Notifications | Notifee v9 |
| Background | `react-native-background-fetch` |
| UI | React Native Paper v5 + Vector Icons |
| Date utils | date-fns v4 |

## Requirements

- Node.js >= 20
- React Native development environment ([setup guide](https://reactnative.dev/docs/set-up-your-environment))
- Android: API 24+ (Android 7.0)
- iOS: iOS 14+

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-username/medi-warden.git
cd medi-warden
npm install
```

### 2. iOS setup (first time only)

```bash
bundle install
bundle exec pod install
```

### 3. Start Metro

```bash
npm start
```

### 4. Run on device or emulator

```bash
# Android
npm run android

# iOS
npm run ios
```

## Project Structure

```
src/
├── app/
│   ├── navigation/         # RootNavigator, MainTabs, route types
│   └── providers/          # AppProviders (DB init, notifications, stores)
├── components/common/      # Reusable UI components
├── hooks/                  # useAdherence and shared hooks
├── screens/
│   ├── home/               # Today's doses, quick Take/Skip actions
│   ├── medications/        # Add/edit medications and schedules
│   ├── history/            # Dose log history
│   ├── profiles/           # Multi-profile management
│   ├── settings/           # App settings and notification preferences
│   └── onboarding/         # First-launch flow
├── services/
│   ├── database/           # SQLite setup, migrations, repositories
│   ├── notifications/      # Notifee channels, triggers, actions
│   ├── scheduler/          # ReminderScheduler — schedule/cancel reminders
│   └── background/         # BackgroundScheduler for background fetch
├── store/                  # Zustand stores (medications, settings, profiles)
├── theme/                  # Colors, typography, spacing
├── types/                  # Shared TypeScript interfaces
└── utils/                  # Date helpers, schedule utilities, constants
```

## Architecture

```
Screens → Zustand Stores → Repositories → SQLite
              ↓
        Services (NotificationService, ReminderScheduler)
```

- **Screens** read from stores and dispatch actions
- **Stores** call repositories for persistence and services for side effects
- **ReminderScheduler** is the single source of truth for notification scheduling; it uses `AlarmType.SET_ALARM_CLOCK` for Doze-proof delivery on Android
- **Background fetch** runs `initializeSchedulingOnStartup` on cold start and periodic wakeup to top up notifications without cancelling displayed ones

### Notification Modes

| Mode | Delivery | User action |
|---|---|---|
| Strict | Full-screen alarm intent | Must act before dismissing |
| Relaxed | Standard heads-up notification | Optional quick actions |

Both modes support Take, Skip, and Snooze actions. Snooze reschedules a one-off trigger at `now + snoozeDuration`.

### Database Schema

| Table | Purpose |
|---|---|
| `profiles` | Named profiles (person or caretaker) |
| `medications` | Medication details and stock |
| `schedules` | Daily / weekly / interval patterns per medication |
| `dose_logs` | Dose events: taken / skipped / missed / pending |
| `settings` | App-wide settings keyed by profile |

Migrations live in `src/services/database/migrations.ts`. The current schema version is **2**.

## Available Scripts

```bash
npm start          # Start Metro dev server
npm run android    # Build and run on Android
npm run ios        # Build and run on iOS
npm run lint       # Run ESLint
npm test           # Run Jest tests
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/your-feature`)
3. Commit your changes (`git commit -m 'feat: add your feature'`)
4. Push to the branch (`git push origin feature/your-feature`)
5. Open a Pull Request

Please follow the existing code style and ensure `npm run lint` passes before submitting.

## License

[MIT](LICENSE)
