# Methodic Muse - Agent Master Guide

## 1. Project Identity & Design System
**Methodic Muse** is a premium, high-focus productivity ecosystem built on React Native and Expo, emphasizing minimalist aesthetics and fluid interactions.

- **Theme Engine:** Adaptive system using `ThemeContext`. Supports `light`, `dark`, and `system` preferences persisted via `@app_theme_mode`.
- **Palette Logic:**
    - **Light (`MM_Colors`):** Royal Blue (`#4052B6`) primary, Soft Lilac (`#F9F5FF`) background.
    - **Dark (`Dark_Colors`):** Deep Obsidian (`#0F0E17`) background, High-legibility Blue (`#8899FF`) primary.
    - **Secondary/Tertiary:** Gold (`#765600`) for emphasis/streaks, Emerald (`#006947`) for success/income.
- **Typography:** Uses `Inter` font family (fallback to `System` on iOS). Implements a responsive scaling system in `ResponsiveSize.ts` utilizing a 390px base width.
- **Micro-Animations:** Heavy use of `Animated` API with `useNativeDriver: true`. Entrance sequences use staggered springs (`Animated.stagger`) with `Easing.out(Easing.back(1))`.

## 2. Technical Architecture

### Core Navigation (`src/navigation/`)
- **`AppNavigator.tsx`**: Uses `@react-navigation/bottom-tabs`. Bottom Tab layout includes Dashboard, Tasks, Budget, Focus, and Journal.
- **Styling**: Tabs use `tabBarActiveTintColor` tied to context colors and custom `Ionicons` mapping.

### Global State & Persistence
- **Storage Strategy**: Namespaced `AsyncStorage` keys for reliable data isolation.
    - `@habits_v3`: Ritual data including id, count, and `lastCompletedDate`.
    - `@daily_notes_v3`: Journal entries with mood, categories, and full-text content.
    - `@daily_expenses_v2`: Ledger of financial transactions.
    - `@budget_limits_v3`: Key-value pairs of `Month-Year` budgets (e.g., `Apr-2026: 15000`).

### Service Layer (`src/services/`)
- **`DailyLogService.ts`**: The "Central Nervous System."
    - **Event Interception**: Listens to `recordTodoCompleted`, `recordHabitCompleted`, and `recordFocusSession`.
    - **Auto-Note Generation**: Upserts a unique note with ID `daily-log-YYYY-MM-DD`.
    - **Structure**: Formats a raw text content containing `TIMESHEET` and `COMPLETED` sections for the Journal to parse.
- **`UpdateService.ts`**: OTA (Over-The-Air) pipeline for Android.
    - **Manifest**: Polls `version.json` from GitHub.
    - **Logic**: Compares `APP_BUILD` and `APP_VERSION`. Triggers `expo-file-system` to download APK and `expo-intent-launcher` to prompt installation.

## 3. Detailed Feature Specifications

### ◈ Dashboard (`DashboardScreen.tsx`)
- **Daily Rituals Logic**:
    - **Reset Engine**: Checked on focus. If `lastCompletedDate` != today, completion is reset. 
    - **Streak Protection**: If `lastCompletedDate` was yesterday, streak increments on next completion; otherwise, reset to 0.
- **Atmospheric Intelligence**:
    - Uses `expo-location` for GPS. Fetches weather data from **Open-Meteo API**.
    - Reverse geocoding translates coordinates to city names via `Location.reverseGeocodeAsync`.
- **Interactive Inspiration**:
    - PanResponder-powered quote card. Left/Right swipe (80px threshold) triggers a spring-animated fetch from `dummyjson.com/quotes`.

### ◈ Deep Focus (`FocusScreen.tsx`)
- **Pomodoro Engine**:
    - State-managed countdown with background persistence via **`AppState` catch-up logic** and **`expo-notifications`** scheduled alerts.
    - Ensures accurate time-tracking and audial alerts even when the phone is manually locked or backgrounded.
    - **Continuous Mode**: Optional toggle allows timer to enter "Overtime" (positive count) post-session instead of auto-switching to Break.
- **Zen Pulse Design**:
    - Breath-sync animation scaling the container `1.0 <-> 1.1` using `Animated.loop` and `Easing.sin`.
- **Feedback Loop**: 
    - Triggers `ImpactFeedbackStyle.Heavy` haptics and **`expo-audio`** (`timer_end.wav`) completion sounds on session end.
    - Synchronized visual celebration modal triggered on sprint completion.

### ◈ Tasks & Priority (`TodosScreen.tsx`)
- **Interactive Registry**:
    - Uses `react-native-gesture-handler` for `Swipeable` rows (Left: Edit, Right: Archive/Delete).
    - **The Sweep**: Custom modal that iterates through the list to clear completed tasks with a bulk removal animation.
- **Smart Scheduling**:
    - Integrates `expo-notifications` to schedule local push alerts for `dueDate` timestamps.
    - **Undo Buffer**: Implements a 4.2-second timeout window using `useRef` timers to allow restoring deleted items.

### ◈ Curated Journal (`NotesScreen.tsx`)
- **Security Logic**:
    - Custom PIN gate using a 6-digit array. Error state triggers a `translateX` shake sequence.
- **Bento UI Grid**:
    - Dynamic layout algorithm. Allocates entries into rows based on a modulo pattern:
        - `Row 1`: Wide focus + Narrow detail.
        - `Row 2`: Three equal-width compact nodes.
        - `Row 3`: Full-width featured accent.
- **Export Engine**:
    - Aggregates journal entries into a clean string, saves as a `.txt` file into `FileSystem.cacheDirectory`, and triggers `Sharing.shareAsync`.

### ◈ Daily Wallet (`BudgetScreen.tsx`)
- **Ledger Logic**:
    - Implements a `SectionList` grouped by `Date`.
    - **Budget Analytics**: Calculates real-time health. Percentages exceeding 90% of `currentLimit` trigger color shifts to `MM_Colors.error`.
- **Month/Year Pivot**: Persistent state for time-traveling through past records with specific month/year budget overrides.

## 4. Engineering Standards & Guardrails
- **Scroll Performance**: All root containers must use `flex: 1`. `ScrollView` must use `contentContainerStyle={{ flexGrow: 1 }}` to avoid layout clipping.
- **Haptic Mapping**: 
    - `Selection/TabSwitch`: `Impact (Light)`
    - `Success/FormSave`: `Notification (Success)`
    - `Deletion/Error`: `Notification (Error)` or `Impact (Heavy)`
- **Native Driver**: Explicit rule: NEVER run layout animations without `useNativeDriver: true` unless animating non-transform properties.
- **Scalability**: All spacing and font-sizes MUST pass through `scaleSize` or `scaleFontSize` from `ResponsiveSize.ts`—never use hardcoded pixel values.
