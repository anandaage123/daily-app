# Monolith - Agent Master Guide

## 1. Project Identity & Design System
**Monolith** is a premium, high-focus productivity ecosystem built on React Native and Expo, emphasizing minimalist aesthetics and fluid interactions.

- **Theme Engine:** Adaptive system using `ThemeContext`. Supports `light`, `dark`, and `system` preferences persisted via `@app_theme_mode`.
- **Palette Logic:**
    - **Light (`MM_Colors`):** Royal Blue (`#4052B6`) primary, Soft Lilac (`#F9F5FF`) background.
    - **Dark (`Dark_Colors`):** Deep Obsidian (`#0F0E17`) background, High-legibility Blue (`#8899FF`) primary.
    - **Secondary/Tertiary:** Gold (`#765600`) for emphasis/streaks, Emerald (`#006947`) for success/income.
- **Typography:** Uses `Inter` font family (fallback to `System` on iOS). Implements a responsive scaling system in `ResponsiveSize.ts` utilizing a 390px base width.
- **Micro-Animations:** Heavy use of `Animated` API with `useNativeDriver: true`. Entrance sequences use staggered springs (`Animated.stagger`) with `Easing.out(Easing.back(1))`.

> **Full feature-level documentation:** `docs/features.md`

## 2. Technical Architecture

### Core Navigation (`src/navigation/`)
- **`AppNavigator.tsx`**: Uses `@react-navigation/bottom-tabs`. Bottom Tab layout includes Dashboard, Tasks, Focus, Journal, and Period (conditional).
- **Period Tracker tab** is hidden by default. Enabled via Journal → Settings → "Enable Period Tracker" toggle, stored in `@settings_period_tracker`.
- **Styling**: Tabs use `tabBarActiveTintColor` tied to context colors and custom `Ionicons`/`MaterialCommunityIcons` mapping.

### Global State & Persistence
- **Storage Strategy**: Namespaced `AsyncStorage` keys for reliable data isolation.
    - `@habits_v3`: Ritual data including id, count, and `lastCompletedDate`.
    - `@todos_v3`: Task list with priority, tag, subtasks, dueDate, archive state.
    - `@daily_notes_v3`: Journal entries with mood, categories, and full-text content.
    - `@weather_cache_v2`: Cached weather data from Open-Meteo API.
    - `@journal_pin_v3`: 6-digit journal PIN.
    - `@monolith_sync_code`: WebSocket sync code for web remote.
    - `@period_logs_v2`: Period cycle logs.
    - `@intimacy_logs_v2`: Intimacy logs (PIN-gated).
    - `@intimacy_pin_v2`: 4-digit intimacy section PIN.
    - `@settings_period_tracker`: Boolean toggle for Period Tracker tab.

### Service Layer (`src/services/`)
- **`DailyLogService.ts`**: The "Central Nervous System."
    - **Event Interception**: Listens to `recordTodoCompleted`, `recordHabitCompleted`, and `recordFocusSession`.
    - **Auto-Note Generation**: Upserts a unique note with ID `daily-log-YYYY-MM-DD`.
    - **Structure**: Formats a raw text content containing `TIMESHEET` and `COMPLETED` sections for the Journal to parse.
- **`UpdateService.ts`**: OTA (Over-The-Air) pipeline.
    - **Manifest**: Polls GitHub Releases API for latest version.
    - **Logic**: Compares `APP_BUILD` and `APP_VERSION`. Shows `UpdateModal` if newer version found.
- **`SyncService.ts`**: WebSocket real-time sync with web remote.
    - Connects to PieSocket (`wss://free.blr2.piesocket.com/v3/{code}`).
    - Handles bidirectional message routing: habits, tasks, notes, timer state.

## 3. Detailed Feature Specifications

### ◈ Dashboard (`DashboardScreen.tsx`)
- **Daily Rituals Logic**:
    - **Reset Engine**: Checked on focus. If `lastCompletedDate` != today, completion is reset. 
    - **Streak Protection**: If `lastCompletedDate` was yesterday, streak increments on next completion; otherwise, reset to 0.
- **Atmospheric Intelligence**:
    - Uses `expo-location` for GPS. Fetches weather data from **Open-Meteo API**.
    - Reverse geocoding translates coordinates to city names via `Location.reverseGeocodeAsync`.
    - Hourly SVG line chart for next 12 hours.
- **Interactive Inspiration**:
    - PanResponder-powered quote card. Left/Right swipe (80px threshold) triggers a spring-animated fetch from `type.fit/api/quotes`. Religious content is filtered.
- **Sync**: WebSocket sync code display and modal; auto-connects on load if code stored.

### ◈ Deep Focus (`FocusScreen.tsx`)
- **Modes**: Pomodoro (25/5), Deep Work (90/15), Zen Flow (10/no break), Custom.
- **Pomodoro Engine**:
    - State-managed countdown with background persistence via **`AppState` catch-up logic** and **`expo-notifications`** scheduled alerts.
    - Ensures accurate time-tracking and audial alerts even when the phone is manually locked or backgrounded.
- **Zen Pulse Design**:
    - Breath-sync animation scaling the container `1.0 <-> 1.1` using `Animated.loop` and `Easing.sin`.
- **Feedback Loop**: 
    - Triggers `ImpactFeedbackStyle.Heavy` haptics and **`expo-audio`** completion sounds on session end.
    - Synchronized visual celebration modal triggered on sprint completion.
- **Water Fill Ring**: Animated fill level rises as timer progresses; two wave layers animate in opposite directions.
- **Task Linking**: Tasks with `expectedMinutes` show a play button → navigates to Focus with task linked. Session time logged back to task on completion.

### ◈ Tasks & Priority (`TodosScreen.tsx`)
- **Interactive Registry**:
    - Uses `react-native-gesture-handler` for `Swipeable` rows (Left: Edit, Right: Archive/Delete).
    - **The Sweep**: Custom modal that iterates through the list to clear completed tasks with a bulk removal animation.
- **Smart Scheduling**:
    - Integrates `expo-notifications` to schedule local push alerts for `dueDate` timestamps.
    - **Undo Buffer**: Implements a ~3-second timeout window using `useRef` timers to allow restoring deleted items.
- **Grocery Mode**: Multi-line text input creates one shopping item per line.
- **Subtasks**: Expandable inline list, progress bar, individual toggle.

### ◈ Curated Journal (`NotesScreen.tsx`)
- **Security Logic**:
    - Custom PIN gate using a 6-digit array. Error state triggers a `translateX` shake sequence.
    - Easter egg: entering `198921` briefly shows PIN reversed (blinks 5x).
- **Bento UI Grid**:
    - Dynamic layout algorithm. Allocates entries into rows based on a modulo pattern:
        - `Row 1`: Wide focus + Narrow detail.
        - `Row 2`: Three equal-width compact nodes.
        - `Row 3`: Full-width featured accent.
- **View Modes**: List, Grid, Bento, Compact (cycles via header icon).
- **Daily Log Notes**: Auto-generated notes (ID: `daily-log-YYYY-MM-DD`) parsed into TIMESHEET + COMPLETED structured view.
- **Export Engine**:
    - Aggregates journal entries into a clean string, saves as a `.txt` file into `FileSystem.cacheDirectory`, and triggers `Sharing.shareAsync`.
- **Period Tracker Toggle**: Settings sheet toggle enables/disables the Period tab globally.

### ◈ Period Tracker (`PeriodTrackerScreen.tsx`)
- **Tabs**: Home, Calendar, Insights, Intimacy.
- **Cycle Engine**: Adaptive average calculation across last N cycles for smarter predictions.
- **Intimacy Section**: Separate 4-digit PIN gate (`@intimacy_pin_v2`). Auto-locks on screen blur.
- **Calendar**: Monthly grid with period/predicted/intimacy day overlays + day detail panel.
- **Insights**: Average stats, regularity indicator, expandable educational cards.
- **Emergency Resources**: Modal with health helplines from `periodTrackerData.json`.

### ◈ Web Companion (Monolith Remote)
- **Files**: `index.html`, `app.css`, `app.js` — all at project root for **GitHub Pages** deployment.
- **WebSockets Strategy**: Connects via 6-char code to PieSocket (`free.blr2.piesocket.com`). Responds to `APP_CONNECTED` event to re-issue `REQUEST_FULL_STATE`. Outgoing messages include `__monolith`, `channel`, `source: 'WEB'` wrapper.
- **Frontend Design System**: Complete dark-mode glassmorphism UI. Uses `Syne` for headings, `DM Sans` for body, `DM Mono` for timers/code. CSS variables: `--bg #050507`, `--accent #7c6fff`, `--green`, `--red`, `--yellow`.
- **View Switching**: `.view { display:none }` / `.view.active { display:block }`. Nav function toggles `.active` class.
- **Responsive Layout**: Sidebar collapses to bottom bar on mobile (<700px). Dashboard, Tasks, Focus, Journal all switch to single-column. Desktop (>1100px) uses 2-column grids.
- **JS Class Mapping**: `ritual-card.completed`, `r-info/r-icon/r-name/r-streak/r-check`, `task-item.completed`, `task-badge.badge-high/med/low`, `task-content`, `task-actions`, `note-card-title/content/footer`, `icon-option.selected`.

## 4. Engineering Standards & Guardrails
- **Scroll Performance**: All root containers must use `flex: 1`. `ScrollView` must use `contentContainerStyle={{ flexGrow: 1 }}` to avoid layout clipping.
- **Haptic Mapping**: 
    - `Selection/TabSwitch`: `Impact (Light)`
    - `Success/FormSave`: `Notification (Success)`
    - `Deletion/Error`: `Notification (Error)` or `Impact (Heavy)`
- **Native Driver**: Explicit rule: NEVER run layout animations without `useNativeDriver: true` unless animating non-transform properties.
- **Scalability**: All spacing and font-sizes MUST pass through `scaleSize` or `scaleFontSize` from `ResponsiveSize.ts`—never use hardcoded pixel values.
- **Swipe containers**: Always set `overflow: 'visible'` on both `containerStyle` and `childrenContainerStyle` of `Swipeable` to prevent shadow clipping.
- **Sync broadcasts**: After any storage write (habits/tasks/notes), call `broadcastSyncUpdate` to keep web remote in sync.
- **Quote pool**: Fetch `type.fit` once per session into `quotesPoolRef`. Never re-fetch on each swipe.
- **Weather cooldown**: `updateWeatherByLocation` has a 30-min guard via `lastWeatherFetchRef`. Never call unconditionally on every focus.
- **Habit reset guard**: `checkAndResetHabitsDaily` runs at most once per calendar day via `lastHabitResetDateRef`.
- **Screen keep-awake**: Use `activateKeepAwakeAsync` / `deactivateKeepAwake` conditionally (only when `isActive === true`). Never call `useKeepAwake()` unconditionally in FocusScreen.
- **Splash animation cleanup**: All `Animated.loop` instances in `App.tsx` (OrbitalArc, TwinklingStar, GlowOrb, corePulse) store their loop ref and call `.stop()` in the effect cleanup.
- **useNativeDriver**: Never use `useNativeDriver: false` on a continuous loop. Use opacity/transform only in loops.
