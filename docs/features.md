# Monolith — Complete App Documentation

> **App Name:** Monolith (package: daily-app)  
> **Platform:** Android (React Native / Expo)  
> **Last Updated:** 2026-04-20

---

## Table of Contents

1. [App Architecture Overview](#1-app-architecture-overview)
2. [Splash / Launch Screen](#2-splash--launch-screen)
3. [Navigation Structure](#3-navigation-structure)
4. [Dashboard Screen](#4-dashboard-screen)
5. [Tasks Screen (Todos)](#5-tasks-screen-todos)
6. [Focus Screen](#6-focus-screen)
7. [Journal Screen (Notes)](#7-journal-screen-notes)
8. [Period Tracker Screen](#8-period-tracker-screen)
9. [Sync / Web Remote](#9-sync--web-remote)
10. [Theme System](#10-theme-system)
11. [Update System](#11-update-system)
12. [Data Persistence](#12-data-persistence)
13. [Global Behaviors](#13-global-behaviors)

---

## 1. App Architecture Overview

```
App.tsx                        ← Root: Splash → Enter → Main App
  └── ThemeProvider            ← Dark/Light theme context
  └── AppSettingsProvider      ← Global toggles (period tracker enabled)
  └── AppNavigator
        ├── Stack.Screen: MainTabs       ← Bottom tab navigator
        │     ├── Dashboard
        │     ├── Tasks
        │     ├── Focus
        │     ├── Journal
        │     └── Period (conditional, off by default)
        └── Stack.Screen: VaultSettingsAuth (fullscreen modal, fade anim)
```

### Key Services
| Service | Purpose |
|---|---|
| `UpdateService.ts` | Version checking against GitHub releases |
| `SyncService.ts` | WebSocket real-time sync with web remote |
| `DailyLogService.ts` | Records habit/todo/focus completions for daily log |

### Key Storage Keys
| Key | Data |
|---|---|
| `@habits_v3` | Daily ritual/habit list |
| `@todos_v3` | Task list |
| `@daily_notes_v3` | Journal notes |
| `@weather_cache_v2` | Cached weather |
| `@journal_pin_v3` | Journal PIN (6-digit) |
| `@vault_primary_pin` | Primary Vault PIN |
| `@period_logs_v2` | Period logs |
| `@intimacy_logs_v2` | Intimacy logs |
| `@intimacy_pin_v2` | Intimacy section PIN (4-digit) |
| `@monolith_sync_code` | WebSocket sync code |
| `@settings_period_tracker` | Period tracker toggle |

---

## 2. Splash / Launch Screen

### Visual Elements
- **Deep space background** (`#080612`) with 60 procedurally-generated twinkling stars
- **Glow Orbs** — two ambient pulsing orbs (purple, rose) in background
- **Orbital Arcs** — 3 rotating arcs of different sizes/speeds providing a cinematic feel
- **Corner Brackets** — 4 decorative corner line elements that animate in with the content
- **Logo** — `//MONOLITH` text with staggered per-letter spring reveal animation
- **Tagline** — "your personal operating system" with delayed fade-in
- **Seek bar** — animated loading/progress bar
- **ENTER button** — pulsing glowing border, ripple on press, "tap to continue" subtext
- **Easter Egg** — long-press the logo area > 800ms reveals a multi-step cinematic overlay

### Entrance Sequence
1. Stars twinkle continuously
2. Orbital arcs begin spinning
3. App name letters spring in staggered (per letter, 100ms apart)
4. Tagline fades in
5. Seek bar progress fills over ~1.5s
6. ENTER button fades/appears
7. Haptic feedback when ENTER is tapped
8. Ripple animation plays, then navigates to main app (full-scale transition)

### ENTER Button Behaviors
| Interaction | Result |
|---|---|
| Tap | Light haptic, ripple animation, navigates to main app |
| Press in | Scale springs to 0.93 |
| Press out | Scale springs back to 1.0 |
| Border | Continuously pulses between dim and bright purple |

### Easter Egg — Multi-Step Overlay
Triggered by long-pressing the logo. A full-screen cinematic overlay with 4 steps:

**Step 0 — "CLASSIFIED" File**
- Red-text "❤️ CLASSIFIED" pill badge
- Scan line sweeps top to bottom
- 3 redacted black bars wipe in (LOVE, LAUGHS, FUN)
- "UNLOCKED ♥" badge springs in
- "REVEAL ›" button appears → advances to Step 1

**Step 1 — Name Reveal**
- Rose ambient glow fills screen
- 3 concentric pulsing sonar rings (rose color)
- Large ♥ heart springs in, continuously pulses
- Text fades in: "in every version of me, / past, present, and becoming, / you were always the destination."
- "continue ›" button → advances to Step 2

**Step 2 — Poem**
- 4 poem lines slide up sequentially with stagger:  
  "You are the reason the late nights" / "felt worth it." / "Every quiet moment I have," / "I spend thinking of you."
- "continue ›" button → advances to Step 3

**Step 3 — Final Signature**
- Final glow pulse
- Signature block slides up
- "Close" button fades in → closes overlay with fade
- Floating hearts continuously rising from bottom throughout all steps

---

## 3. Navigation Structure

### Bottom Tab Bar
Always visible across main screens. Height 90px.

| Tab | Icon (active/inactive) | Screen |
|---|---|---|
| Dashboard | `home` / `home-outline` | DashboardScreen |
| Tasks | `list` / `list-outline` | TodosScreen |
| Focus | `timer` / `timer-outline` | FocusScreen |
| Journal | `book` / `book-outline` | NotesScreen |
| Period *(optional)* | `calendar-heart` / `calendar-heart-outline` | PeriodTrackerScreen |

- Active tab uses `colors.primary`, inactive uses `colors.textVariant`
- Period tab only appears if `periodTrackerEnabled` is `true` (set in Journal screen settings)
- Tab labels: 10px, weight 600

### Stack Navigation
- **MainTabs** — default, slide-from-right animation
- **VaultSettingsAuth** — `VaultScreen` as a fullscreen modal with fade animation; accessed from Journal screen settings

---

## 4. Dashboard Screen

### Overview
The central command center. Displays daily rituals, weather, inspirational quote, and real-time sync status.

---

### 4.1 Header Section
- **Greeting** — time-of-day greeting ("Good morning", "Good afternoon", etc.) with user's name
- **Date display** — current day and date
- **Sync indicator** — shows sync code or connection status
- **Settings/sync icon button** — opens Sync Modal

---

### 4.2 Motivational Quote Card
- Displays a random motivational quote fetched from `type.fit/api/quotes`
- Falls back to 20 built-in quotes on network failure
- Religious quotes are filtered out automatically
- **Swipe left/right** on the card to load a new quote with slide animation + haptic
- Quote text + author attribution

---

### 4.3 Daily Rituals Section

#### Ritual Card
Each habit displayed as a card with:
- **Icon** — one of 12 preset Material/MaterialCommunity icons
- **Habit name**
- **Streak count** — number of consecutive completions
- **Completion ring** — SVG circular progress ring (green at 100%)
- **Checkbox** — tap to toggle complete/incomplete
- **Time spent** — if `expectedMinutes` set, shows time tracking badge

#### Habit Interactions
| Interaction | Result |
|---|---|
| Tap card / checkbox | Toggles complete state, haptic, bounce animation, records in daily log |
| Swipe right | Reveals **Edit** action (purple button) |
| Swipe left | Reveals **Delete** action (red) → confirm dialog |
| Complete habit | If newly completing today: increments streak count |
| Un-complete habit | If completed today: decrements streak count |

#### Daily Reset Logic
- At midnight, habits with `lastCompletedDate` = yesterday are soft-reset (completed → false, streak preserved)
- Habits not completed in 2+ days reset streak count to 0

#### Completion Rate Display
- Shows overall % of today's rituals completed
- Motivational message changes based on threshold: 0%, >0%, >50%, >75%, 100%
- At 100%: celebration animation springs in — scale + opacity, success haptic, auto-dismisses after 2s

#### Add Habit Button (`+` FAB)
Opens a bottom sheet modal with:

**Add/Edit Habit Modal Fields:**
| Field | Type | Notes |
|---|---|---|
| Name | Text input | Required |
| Icon picker | 12-icon grid | Tap to select |
| Expected time | Hours + Minutes inputs | Optional, enables time tracking |
| Save / Update | Button | Creates or edits habit |

---

### 4.4 Weather Widget

#### Weather Card Contents
- **Temperature** — current °C
- **City name** — from reverse geocoding
- **Weather status** — text description (Clear Skies, Partly Cloudy, Foggy, Rain Showers, etc.)
- **Weather icon** — Ionicons mapped to weather code
- **Feels like** — apparent temperature
- **Humidity** — %
- **Wind speed** — km/h
- **Hourly graph** — SVG line chart with animated fill (next 12 hours)

#### Hourly Weather Graph
- Time labels every 3rd hour (12a / 6a / 12p format)
- Emoji weather icons above each label point
- Temperature labels below graph
- Current hour highlighted with a filled dot and vertical dashed line
- Smooth cubic bezier curve connecting temperature points

#### Weather Interactions
| Element | Action |
|---|---|
| Tap weather card | Expands/collapses hourly forecast |
| Refresh icon | Manually re-fetches weather (requires location permission) |

#### Location Permissions
- Requests foreground location permission
- If denied: inline toast "Location permission is required for weather"
- If GPS disabled: inline toast "Please enable GPS to fetch weather"
- Uses Open-Meteo free API (no key required)

---

### 4.5 Sync Modal
Opened via the sync icon in the header.

**Contents:**
- Sync code display (6-character alphanumeric)
- Input field to enter a code from the web remote
- **Connect** button — connects WebSocket and auto-broadcasts full state
- **Disconnect** button — closes WebSocket, clears stored code
- **Force Refresh** button — broadcasts `REQUEST_FULL_STATE` to sync web remote
- Sync code is persisted across app restarts

---

### 4.6 Delete Habit Confirmation Dialog
- Custom in-app modal (not native Alert)
- Shows habit name to delete
- **Cancel** and **Delete** buttons

---

## 5. Tasks Screen (Todos)

### Overview
Full-featured task manager with priorities, tags, subtasks, due dates, archive, grocery mode, search, filter, undo, and export.

---

### 5.1 Header
- Screen title "Tasks"
- **Search bar** — real-time filter across task text
- **Filter chips** — priority filter: ALL / 🔥HIGH / ⚡MED / 🌿LOW
- **Show/Hide Done toggle** — toggles visibility of completed tasks
- **Archive icon** — opens Archive Sheet
- **Export icon** — exports tasks as `.txt` file via system share sheet
- **Add button (`+`)** — opens Add Task modal

---

### 5.2 Task Tabs
Two tabs at top:
- **Todo** — all non-shopping tasks
- **Grocery** — shopping list items (displayed differently)

---

### 5.3 Task List

#### Task Card
Each task card displays:
- **Priority color strip** — left edge colored bar (red/orange/green)
- **Checkbox** — animated fill on completion; circular for tasks, square for shopping
- **Task text** — 2-line limit, strikethrough when done, dimmed opacity
- **Priority pill** — gradient badge (🔥 HIGH / ⚡ MED / 🌿 LOW)
- **Tag pill** — colored badge (#WORK, #PERSONAL, etc.)
- **Due date pill** — date display; turns orange if due soon, red if overdue
- **Subtask count badge** — "X/Y ▾" shows progress, tap to expand
- **Subtask progress bar** — thin bar below count
- **Play button** (⏯) — if `expectedMinutes` set, navigates to Focus screen with task linked
- **Spark emoji** (✨) — appears briefly on task completion

#### Task Interactions
| Interaction | Result |
|---|---|
| Tap task (no subtasks) | Toggles complete |
| Tap task (with subtasks) | Expands/collapses subtasks |
| Long press task | Opens Edit modal |
| Tap checkbox | Toggles complete, haptic, bounce animation |
| Swipe right | Reveals **Edit** button (primary color) |
| Swipe left | Reveals **Archive** (orange) + **Delete** (red) buttons |
| Tap subtask row | Toggles subtask complete |
| Tap play button | Opens Focus screen pre-linked to this task |

#### Section Headers
- Separate visual dividers for: ACTIVE, DONE, SHOPPING
- Header row: small uppercase label + horizontal rule

---

### 5.4 Add / Edit Task Modal
Bottom sheet that slides up from bottom.

**Mode toggle (top):**
- **Grocery Mode** toggle card — switches modal to multi-line shopping list entry

**Non-Shopping Fields:**
| Field | Description |
|---|---|
| Task text input | Required, auto-focus |
| Priority selector | LOW / MED / HIGH horizontal row of buttons |
| "Show More Options" button | Expands advanced fields |
| Tag selector | Horizontal scroll chips: Work, Personal, Health, Finance, Other |
| Notes input | Multi-line text area |
| Expected Duration | Hours + Minutes number inputs |
| Due Date | Inline date picker (native DateTimePicker) + clear button |
| Subtasks | List of existing subtasks + add subtask input |
| Add subtask (+) | Button or Return key to add |
| Save / Add Task | Gradient button at bottom |

**Shopping Mode Fields:**
| Field | Description |
|---|---|
| Multi-line text input | Type one item per line (Milk\nEggs\nBread...) |
| Add All Items button | Creates one task per line |

**Modal Buttons:**
- Close (✕) — top right, dismisses modal
- Save Changes / Add Task / Add All Items — context-aware label

---

### 5.5 Archive Sheet
Modal showing all archived tasks.
- Swipe left to **unarchive** or **delete permanently**
- Empty state if no archived tasks

---

### 5.6 Clear Completed Dialog
- Confirms deletion of all completed tasks
- Cancel / Clear All buttons

---

### 5.7 Undo Toast
After deleting a task, an undo toast appears at bottom of screen for ~3 seconds.
- **UNDO** button restores the deleted task

---

### 5.8 Export
Tapping export icon triggers native share sheet with a `.txt` file containing all tasks formatted with priority, tags, subtasks, and due dates.

---

## 6. Focus Screen

### Overview
A multi-mode productivity timer featuring Pomodoro, Deep Work, Zen Flow, and Custom modes. Features an animated water-fill ring, sprint tracking, audio, and a completion celebration overlay.

---

### 6.1 Focus Modes
| Mode | Focus Duration | Break | Sprints | Color |
|---|---|---|---|---|
| 🍅 Pomodoro | 25 min | 5 min | 4 | Blue `#1A73E8` |
| ⚡ Deep Work | 90 min | 15 min | 2 | Purple `#7B1FA2` |
| 🌿 Zen Flow | 10 min | None | 1 | Green `#0F9D58` |
| ⚙️ Custom | Configurable | Configurable | 1–6 | Orange `#F57C00` |

---

### 6.2 Setup Screen (Before Starting)

#### Mode Selector
- 4 mode cards in a horizontal scroll
- Active mode highlighted with colored border
- Mode shows: emoji, name, description

#### Session Name Input
- Text input labeled "Session Name"
- Placeholder: "What are you focusing on?"

#### Tag Selector
- Horizontal chips: Work, Code, Study, Personal, Health, Zen
- Each with a matching Ionicon

#### Zen Duration Presets (Zen mode only)
- Preset pill buttons: 2, 5, 10, 15, 20, 30, 45, 60 min

#### Custom Mode Settings
- Focus duration stepper (opens TimePickerSheet)
- Break duration stepper (opens TimePickerSheet)
- Sprint count selector (1–6)

#### Linked Task Display
- If navigated from a task with `expectedMinutes`, shows linked task card
- Displays task name + expected vs elapsed time

#### Start Button
- Large gradient button at bottom
- Disabled if no session name entered

---

### 6.3 Time Picker Sheet
Bottom sheet for setting custom focus/break duration.

**Contents:**
- Title and current value display
- MM stepper (↑/↓ buttons, +1 min step)
- SS stepper (↑/↓ buttons, +5 sec step)
- Quick preset chips: 30s, 1m, 2m, 5m, 10m, 15m, 25m, 30m, 45m, 60m, 90m (focus); None, 30s, 1m, 2m, 3m, 5m, 10m, 15m (break)
- **Set [duration]** confirm button

---

### 6.4 Active Timer Screen

#### Visual Ring
- Large circular ring (270px diameter)
- **Water Fill** animation — liquid level rises as timer progresses
  - Two animated wave layers moving in opposite directions
  - Fill percentage updates every second
- Remaining time displayed in center (MM:SS)
- Mode label (FOCUS / BREAK)
- Sprint progress below: colored dots, current dot is wider/animated

#### Timer Controls
| Button | Action |
|---|---|
| Play / Pause | Starts or pauses timer; haptic on tap |
| Reset | Opens ConfirmSheet to reset or skip |
| Skip Sprint | Advances to next sprint or break phase |

#### Sprint Dots
- Filled dot = completed sprint
- Wider animated dot = current sprint
- Empty dot = upcoming sprint

#### Status Bar
- Shows current phase label: "FOCUS TIME" or "BREAK TIME"
- Shows sprint number: "Sprint 2 of 4"

#### Background Audio
- Uses `expo-audio` for ambient sound playback (if configured)

#### Screen Keep-Awake
- `expo-keep-awake` active while timer is running, released on pause/complete

#### App State Handling
- Timer pauses when app goes to background
- Schedules a local push notification for session completion if going background

#### Sync Integration
During active timer, broadcasts `TIMER_STATE_UPDATE` to web remote:
- `isRunning`, `timeRemaining`, `mode`

---

### 6.5 Break Screen
- Different color theme (green tones)
- "BREAK TIME" label
- Breathe animation (pulsing ring)
- Skip break button → jumps to next focus sprint

---

### 6.6 Completion Celebration Overlay
Shown when all sprints complete.

**Contents:**
- Dark overlay with 2 expanding pulsing rings
- White card springs in with scale spring
- Trophy emoji or mode emoji
- "Session Complete!" heading
- Stats: Total time, sprints completed, session name
- Two buttons: **Log & Exit** (saves session to daily log) / **Exit Without Saving**

**On Log & Exit:**
- Calls `recordFocusSession()` in DailyLogService
- If linked to a todo: calls `recordTodoCompleted()`
- If linked to a habit: calls `recordHabitCompleted()`
- Updates `timeSpentSeconds` on the linked item in AsyncStorage

---

### 6.7 Confirm Sheet (Reset Dialog)
Custom bottom sheet with:
- Icon (warning/error color)
- Title and optional message
- Multiple action buttons styled as: default / destructive / cancel

---

### 6.8 Session History
Below setup UI, a scrollable list of past sessions:
- Session name, tag, duration, date
- Mode color indicator
- Swipe to delete individual sessions

---

## 7. Journal Screen (Notes)

### Overview
A PIN-protected personal journal with multiple view modes, date filtering, mood tracking, pinning, and export.

---

### 7.1 PIN Authentication Gate

**First Launch (No PIN Set):**
- Journal opens directly (no protection)

**With PIN Set:**
- Shows PIN entry screen before accessing content

#### PIN Screen Layout
- Title: "Unlock Journal"
- 6 dot PIN display (fills as digits entered)
- 10-button numpad (1–9, 0) + backspace (⌫)
- Wrong PIN: shake animation + haptic error feedback
- Success: haptic success, navigates to journal list

#### PIN Setup Flow
1. User triggers "Set PIN" from settings
2. Screen shows "Set Security PIN" with prompt
3. Enter 6 digits → stored as temp
4. Screen switches to "Confirm PIN"
5. Re-enter same 6 digits → saved to `@journal_pin_v3`
6. Alert: "✓ Security Set — Your journal is now protected"

#### PIN Mismatch
- Alert: "✗ PIN Mismatch — Please try again"
- Returns to step 1

#### Easter Egg (Hint)
- Entering `198921` on the keypad (without submit) briefly shows the saved PIN reversed, blinking 5 times

---

### 7.2 Journal List Screen

#### App Bar
| Element | Action |
|---|---|
| "Journal" title | — |
| Search icon | Toggles search bar |
| Calendar icon | Opens date range filter modal |
| View mode icon | Cycles through List → Grid → Bento → Compact → List |
| Settings icon | Opens Settings Sheet |

#### Stats Row
Two stat cards:
- **Total Entries** — count of all notes
- **This Month** — count of notes in current month

#### Search Bar (collapsible)
- Text input with clear button
- Real-time filters notes by title and content

#### Date Filter Chips
- "From [date]" pill — purple chip when active, shows selected date
- "To [date]" pill — same behavior
- Tapping chip opens mini-calendar in a modal

---

### 7.3 View Modes

#### List View (default)
Each note card:
- Left 4px color accent bar (unique per-note color from palette)
- Left-to-right gradient overlay using note's accent color
- Note title (bold) + mood emoji (top right)
- Content preview (2 lines)
- Bottom row: type badge (ENTRY / DAILY LOG) + date

#### Grid View
- 2-column layout
- Top 4px color border per card
- Note title (2 lines) + preview (3 lines)
- Date at bottom

#### Bento View
- Alternating layout patterns (wide+narrow, 3-equal, full-width)
- Pattern cycles every 2 rows keeping visual variety

#### Compact View
- Single-line rows
- Colored dot on left
- Title + single-line content preview
- Mood emoji + date on right

---

### 7.4 Note Card Interactions
| Interaction | Action |
|---|---|
| Tap | Opens note in view/edit mode |
| Long press | Toggles pin state (📌 appears in title if pinned) |

Pinned notes always appear at top of list.

---

### 7.5 Note Editor

#### Enter Edit Mode
- Tap note card → view mode (read-only display)
- Tap "Edit" button in view → full edit mode
- Tap "New Note" FAB → blank edit mode

#### Editor Fields
| Field | Details |
|---|---|
| Title input | Large bold text, top |
| Mood selector | 5 emoji buttons: 😀 ❤️ 😐 😩 😡 |
| Content input | Multi-line, min height 280px |
| Timestamp Insert button | Inserts current time at cursor position |

#### Bottom Action Bar
- **Cancel** — discards changes, returns to list
- **Save** — saves note, broadcasts sync update

#### Daily Log Notes (Auto-generated)
Daily log notes (ID prefixed `daily-log-`) have a special structured view:
- **TIMESHEET** section — time-stamped activity rows
- **COMPLETED** section — habit/todo completion records
- Manual notes section for free-form additions
- Parsed and rendered in styled blocks

---

### 7.6 Note Actions (in View Mode)
- **Edit** — enters edit mode
- **Pin / Unpin** — toggles pin
- **Delete** — confirmation dialog → removes note
- **Share** — exports note as text via system share

---

### 7.7 Settings Sheet

| Setting | Action |
|---|---|
| Export Journal | Exports all notes as `.txt` file via share |
| Set / Change PIN | Triggers PIN setup flow |
| Disable PIN | Confirmation dialog → removes PIN protection |
| Enable Period Tracker | Toggle switch → adds/removes Period tab from nav |

---

### 7.8 Date Range Filter Modal
- Mini calendar (month view)
- Navigate months with ← → buttons
- Days with notes show a colored dot indicator
- Tap a day to set as "from" or "to" date
- Applied filter shows active pills in the list header

---

## 8. Period Tracker Screen

> **Note:** This screen is hidden by default. Enabled via Journal → Settings → "Enable Period Tracker" toggle.

### Overview
A private, comprehensive cycle tracking tool with 4 tabs: Home, Calendar, Insights, and Intimacy (PIN-locked).

---

### 8.1 Tab Bar (Bottom)
4 tabs with animated indicator pill that slides between them:
| Tab | Icon | Description |
|---|---|---|
| Home | wave | Summary, alerts, phase info, quick actions |
| Calendar | calendar | Monthly calendar with period/intimacy overlays |
| Insights | chart-bar | Cycle statistics and educational cards |
| Intimacy | heart (locked) | Private intimacy log, PIN-protected |

Switching tabs: haptic selection feedback + spring animation on indicator.

---

### 8.2 Home Tab

#### Alert Banners
Context-sensitive banners at top:
- **Info** (blue) — "Private Mode Available" (first launch, no logs)
- **Danger** (red) — "Period is X days late" (when overdue)
- **Info** (ongoing) — "Period ongoing — Day X" + "Mark as Finished" action link
- **Warning** — risk window active after unprotected intimacy

#### Phase Hero Card
Displays current cycle phase:
- Phase name + icon (from CYCLE_PHASES data)
- Phase color
- Phase description
- Characteristics list
- Recommendations list

#### Cycle Day Indicator
- Large current cycle day number
- "Day X of Y" label
- Progress arc/ring showing position in cycle

#### Next Period Prediction
- Predicted date display
- Days until next period countdown
- Color-coded: normal/approaching/late

#### Quick Action Buttons
- **Log Period** — opens period log modal
- **Log Intimacy** — requires PIN, opens intimacy log modal (or PIN setup)

#### History List (Last 3 entries)
Recent period logs showing:
- Start date, duration
- Flow intensity, mood
- Tap to edit

---

### 8.3 Period Log Modal (3-step wizard)

**Step 0: Intent**
- Title: "Log Period"
- "New Period" button
- "Update Ongoing" button (if active)
- "Edit Past Entry" button

**Step 1: Date**
- **Start Date** — CalendarPicker component (expandable inline)
- **End Date** — CalendarPicker (or "Ongoing" toggle)
- **Ongoing toggle** — marks period as not yet ended

**Step 2: Details**
- **Flow Intensity** — 5 chips: Spotting, Light, Normal, Heavy, Very Heavy
- **Mood Selector** — 8 emoji chips: 😊 ❤️ 😰 😤 😌 ⚡ 😴 😶
- **Pain Level** — 5-step segmented control (😌 None → 🤯 Extreme)
- **Symptoms** — 3 groups (Physical, Mood & Wellbeing, Cycle Markers), multi-select chips
- **Notes** — free text input
- **Save Period** button

**Validation:**
- Start date cannot be in the future
- End date cannot be before start date
- End date cannot be in the future
- Overlap detection → confirmation dialog before saving

---

### 8.4 Calendar Tab

#### Monthly Calendar
- Month/year header with ← → navigation
- Day grid (7 columns)
- **Period days** — colored fill (rose)
- **Predicted period days** — lighter fill
- **Intimacy days** — dot indicator
- **Today** — border highlight
- **Selected day** — filled with accent

#### Day Detail Panel
- Tapping a day shows below: period log for that day, intimacy log for that day
- Edit/Delete buttons per entry

---

### 8.5 Insights Tab

#### Summary Stats Cards
Grid of metric cards:
- Average cycle length
- Average period duration
- Cycles tracked count
- Most common symptoms
- Most common mood

#### Cycle Health Indicators
Color-coded indicators:
- Cycle regularity (regular / slightly irregular / irregular)
- Average pain level

#### Educational Cards (expandable)
Cards from `INSIGHTS_KNOWLEDGE` data:
- Tap to expand/collapse additional text
- Topics: phase characteristics, symptom explanations, general health tips

---

### 8.6 Intimacy Tab (PIN-locked)

#### PIN Modal
4-digit PIN entry (separate from journal PIN):

**First Access (No PIN Set):**
1. PIN modal opens in "setting" mode
2. Enter 4-digit PIN
3. Confirm 4-digit PIN
4. Saved to `@intimacy_pin_v2`
5. Tab unlocked → animates to Intimacy tab

**Subsequent Access:**
- Enter saved 4-digit PIN
- Wrong PIN: shake animation + haptic error
- Correct PIN: unlocks tab, animates background

**Auto-lock:** Intimacy section locks automatically when leaving the Period Tracker screen.

**Easter Egg:** Double-tap the "Cycle" heading on Home tab → directly attempts to open Intimacy section.

#### Intimacy Log List
Per entry:
- Date
- Protection method badge (Condom / Pill / IUD / Implant / None / Other)
- Notes (if any)
- Edit (pencil) button → reopens form pre-filled
- Delete button → confirmation sheet

#### Log Intimacy Modal
- Date picker (CalendarPicker)
- Protection method: 6 chips (Condom, Pill, IUD, Implant, None, Other)
- Notes text input
- **Save** button

#### Risk Alerts
If last intimacy was unprotected within 5 days:
- Orange warning banner shown on Home tab

---

### 8.7 Settings Modal (Period Tab)
- Cycle Length input (number) — default 28
- Period Duration input (number) — default 5
- **Save Settings** button → persists and recalculates predictions

---

### 8.8 Emergency Resources
- Accessible via a button on Home tab
- Lists emergency helpline numbers and health resources from `EMERGENCY_RESOURCES` data
- Opens in a modal sheet

---

### 8.9 Toast Notifications
Spring-animated top toast for all actions:
- **Success** (green) — "Period logged ✓", "Entry saved ✓"
- **Error** (red) — validation messages
- **Info** (blue) — informational
- **Warning** (orange) — overlap/conflict notices
- Auto-dismisses after 3.2 seconds

---

## 9. Sync / Web Remote

### Files
| File | Location | Purpose |
|---|---|---|
| `index.html` | project root | Web remote UI — served by GitHub Pages |
| `app.css` | project root | Styles for web remote |
| `app.js` | project root | Logic, WebSocket handler, DOM updates |

### Architecture
- Uses PieSocket WebSocket service (`wss://free.blr2.piesocket.com/v3/{code}`)
- 6-character alphanumeric sync code identifies the private channel
- App connects as `source: 'APP'`; web remote connects as `source: 'WEB'`
- All messages tagged with `__monolith: true` and channel code for collision avoidance

### Connection Flow
1. Dashboard loads → checks `@monolith_sync_code` from storage
2. If code exists → auto-connects WebSocket
3. Sends `APP_CONNECTED` message on open
4. Subscribes to incoming messages → routes to handler

### Message Types (Inbound from Web Remote)

| Type | App Behavior |
|---|---|
| `REQUEST_FULL_STATE` | Broadcasts all app state (tasks, notes, habits, weather, quote, timer) |
| `HABIT_TOGGLE` | Toggles habit complete state in storage + UI |
| `TASK_ADD` | Creates new task in storage |
| `TASK_TOGGLE` | Toggles task complete state |
| `TASK_DELETE` | Removes task from storage |
| `NOTE_ADD` | Adds new note to storage |
| `TIMER_START` / `TIMER_PAUSE` / `TIMER_RESET` | Broadcasts timer state back to web |

### Message Types (Outbound to Web Remote)

| Type | Trigger |
|---|---|
| `APP_CONNECTED` | On WebSocket open |
| `FULL_STATE_SYNC` | Response to REQUEST_FULL_STATE |
| `HABIT_STATE_UPDATE` | After any habit change |
| `TASK_STATE_UPDATE` | After any task change |
| `NOTE_STATE_UPDATE` | After any note change |
| `TIMER_STATE_UPDATE` | After timer control received |

### Sync Modal (Dashboard)
| Control | Function |
|---|---|
| Code display | Shows current 6-char sync code |
| Code input + Connect | Joins a new channel by code |
| Force Refresh | Re-broadcasts full state |
| Disconnect | Closes WebSocket, clears stored code |

---

## 10. Theme System

### Modes
- **Dark** — default, deep navy/purple palette
- **Light** — clean white palette
- Toggle accessible via Dashboard header or Journal settings

### Color Tokens
| Token | Dark | Light |
|---|---|---|
| `background` | `#080612` | `#FAFAFA` |
| `surface` | `#12101e` | `#FFFFFF` |
| `primary` | `#5B4FE8` | `#5B4FE8` |
| `text` | `#FFFFFF` | `#11101F` |
| `textVariant` | `rgba(196,189,255,0.45)` | `#8080A0` |

### Font Scaling
`scaleFontSize(n)` and `scaleSize(n)` utilities proportionally scale sizes based on device screen width relative to a 414px baseline, ensuring responsive layout across all screen sizes.

---

## 11. Update System

### Source
- Checks GitHub Releases API: `https://api.github.com/repos/anandaage/daily-app/releases/latest`
- Compares against `APP_VERSION` constant in `UpdateService.ts`

### Flow
1. On app launch, `checkForUpdates()` is called
2. If newer version found → `UpdateModal` is shown
3. Modal shows release notes / changelog
4. **Update Now** button → opens GitHub release URL in browser
5. **Later** button → dismisses modal (non-blocking)

### UpdateModal
- Title: "New Update Available"
- Current vs new version display
- Release notes from GitHub API
- Two buttons: Update Now / Maybe Later

---

## 12. Data Persistence

All data uses **AsyncStorage** (local, on-device). No cloud sync except via the WebSocket sync feature.

### Data that Persists
- All habits (streak counts, completion state, time spent)
- All todos (text, priority, tag, subtasks, due dates, archive state)
- All journal notes (title, content, mood, pin/unpin state)
- Weather cache (to avoid re-fetching immediately on reopen)
- Journal PIN
- Sync code
- Period/intimacy logs
- Intimacy PIN
- Period tracker settings (cycle length, duration)
- App settings (period tracker toggle)
- Focus session history

### Data that Resets
- Habit `completed` state resets daily (based on `lastCompletedDate`)
- Habit `count` (streak) resets if there is a gap of 2+ days
- Timer state is not persisted across app restarts

---

## 13. Global Behaviors

### Haptics
Used throughout the app for tactile feedback:
- **Light impact** — general taps, habit toggles, quote swipes
- **Medium impact** — modal open, note save
- **Heavy impact** — destructive actions
- **Success notification** — task complete, habit complete, PIN success
- **Error notification** — wrong PIN, validation failure
- **Warning notification** — overlap/conflict

### Inline Toast (Dashboard)
- Slides in from top, auto-dismisses after 2.2s
- Used for: weather errors, sync status messages

### Undo System (Todos)
- Delete task → 3-second undo window
- Toast with "UNDO" button
- After 3s, deletion is permanent

### Swipe-to-Action
- Used on: habit cards, todo items, password rows, media items
- Right swipe → positive action (Edit)
- Left swipe → negative action (Archive / Delete)
- `overshootRight: false` prevents bounce

### Screen Keep-Awake
- Only active during Focus timer sessions
- Released on pause/complete

### Screen Capture Protection
- Optional in Vault settings
- Uses `expo-screen-capture` to prevent screenshots when enabled

### Keyboard Avoidance
- `KeyboardAvoidingView` used on all modal/editor screens
- `behavior: 'padding'` on iOS, `behavior: 'height'` on Android

---

*End of documentation.*
