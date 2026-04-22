# Changelog

## v3.7.4 (2026-04-22)

- chore: update device streaming configuration and project assets

## v3.7.3 (2026-04-22)

- feat: add native Android homescreen widget support and implement a reports analytics view for focus tracking
- refactor: remove Galaxy S23 device cache and update index.html structure
- Update the README with the latest change information.

## v3.7.2 (2026-04-20)

- perf: reduce battery drain in Focus and Journal screens
- perf: optimise battery and CPU usage
- docs: update agents.md with current architecture and file locations
- chore: move web remote files to root for GitHub Pages
- docs: add comprehensive app feature documentation

## v3.7.1 (2026-04-19)

- refactor: simplify CSS variables and update font configuration in index.html
- feat: implement dark-mode glassmorphism UI and PieSocket integration for Web Companion

## v3.7.0 (2026-04-19)

- refactor: update design system to premium linear-like aesthetic with Inter font and refined color palette
- feat: enhance dashboard UI with ambient glow, backdrop blur, hover effects, and responsive desktop layouts
- feat: implement WebSockets demo mode and optimize desktop UI responsiveness
- refactor: redesign remote interface with new bento-grid layout and pairing screen
- feat: analyze and replicate dashboard/journal bento layout to web, add subtasks and weather syncing, and implement force refresh connectivity button
- fix: safeguard against undefined priority crashing the app
- fix: remove non-existent budget code to match app
- feat: complete V2 of web remote including Rituals, Wallet, Journal composing, and Task deletions
- fix: wait for websocket to open before broadcasting initial state
- fix: utilize new PieSocket personal cluster for stable syncing
- feat: persist web UI connection via localStorage & unlink action
- fix: cache busting for index.html
- refactor: invert sync pairing flow to generate codes on web and connect via mobile modal
- chore: Move web companion to /docs for native GitHub Pages hosting on master
- feat: Instant reactive push syncing for Tasks and Notes, switched default branch to main
- feat: Add Journal entries sync to Web Remote interface
- fix: Switch WebSocket service from PieSocket to SocketsBay with custom channel payload due to connectivity issues
- fix: Update WebSocket cluster URL and API key to resolve connection failure
- feat: Add companion web remote and Dashboard interface integration
- adds changlog file
- refactor: improve swipeable interaction, update ritual deletion UI, and refine dynamic text coloring for dark mode

## Unreleased

- **4feb9d5** (2026-04-19): refactor: improve swipeable interaction, update ritual deletion UI, and refine dynamic text coloring for dark mode

## v3.5.5 (2026-04-19)

- **ed437c8** (2026-04-19): refactor: replace custom XOR encryption with direct file copying and implement Swipeable for vault items with added PIN attempt limits.
- **31210db** (2026-04-13): update: gitignore
- **3efb9f4** (2026-04-13): updates UI for dashboard
- **0e44ee8** (2026-04-12): feat: implement time picker component and update focus mode presets with emojis and descriptions

## v3.5.2 (2026-04-11)

- **e639210** (2026-04-11): chore: update device streaming cache and release build artifacts

## v3.5.0 (2026-04-11)

- **424d82c** (2026-04-11): imp feat: remove BudgetScreen and associated navigation entries
- **2e6e9eb** (2026-04-11): chore: add clean script and remove unused clipboard and vector-icon types

## v3.3.17 (2026-04-11)

- **6ff445a** (2026-04-11): feat: implement background timer persistence using AppState and add audio notifications for session completion

## v3.3.14 (2026-04-11)

- **e01c864** (2026-04-11): feat: add AppSettingsContext and PeriodTrackerScreen, and update keep-awake implementation

## v3.3.12 (2026-04-10)

- **c1b5396** (2026-04-10): chore: update application icons

## v3.3.9 (2026-04-09)

- **2948f00** (2026-04-09): feat: add vertical spacing to TodosScreen header and update Monolith.apk

## v3.3.6 (2026-04-09)

- **2ee7078** (2026-04-09): update project documentation
- **4079024** (2026-04-09): feat: add comprehensive iOS and Android application icon assets and configuration

## v3.3.5 (2026-04-09)

- **9aca795** (2026-04-09): feat: integrate expo-haptics for tactile feedback across UI interactions and actions
- **34bdb03** (2026-04-09): feat: implement overtime tracking, haptic feedback milestones, and manual break transitions in FocusScreen

## v3.3.2 (2026-04-09)

- **b34c776** (2026-04-09): feat: filter release note links and update error icon in UpdateModal
- **18ebf58** (2026-04-09): refactor: remove release URL dependency from triggerInstall and update error handling in UpdateModal
- **d80690d** (2026-04-09): feat: add streak removal logic for habits and todos and update dashboard UI

## v3.3.1 (2026-04-09)

- **0c0b6b5** (2026-04-02): refactor: remove category management and implement dynamic note styling with timestamp insertion logic

## v3.3.0 (2026-04-02)

- **470f853** (2026-03-31): refactor: updates the welcom screen animation
- **88d7afa** (2026-03-31): style: format code with consistent spacing and indentation throughout App.tsx
- **3d63a03** (2026-03-31): replace SAF storage with AsyncStorage in TodosScreen and improve BudgetScreen limit modal UI

## v3.2.0 (2026-03-31)

- **67c2539** (2026-03-31): feat: add responsive sizing utility and integrate across screen components

## v3.1.11 (2026-03-30)

- **579f702** (2026-03-30): feat: add habit deletion confirmation modal and animations in DashboardScreen

## v3.1.3 (2026-03-29)

- **ce50bfb** (2026-03-29): refactor: update FocusScreen layout with improved notch padding and redesigned timer UI components

## v3.1.1 (2026-03-29)

- **6c3fbec** (2026-03-29): feat: implement animated water fill, sprint tracking, and completion celebration in FocusScreen

## v3.1.0 (2026-03-29)

- **6c7c8ad** (2026-03-29): feat: overhaul FocusScreen with multi-mode timer system and update Dashboard UI typography

## v3.0.0 (2026-03-28)

- **6eee548** (2026-03-28): refactor: migrate screens to use theme context and update UI components for consistent styling
- **9e00f84** (2026-03-28): feat: implement dynamic theme support and add toggle controls to dashboard header
- **e51ebcf** (2026-03-28): Implement ThemeContext for dynamic light and dark mode support across the application
- **3284f94** (2026-03-28): upgrade PIN security with v3 migration, haptic feedback, and improved journal export functionality

## v2.2.1 (2026-03-28)
- v2.2.1: Update manifest
- **75b187e** (2026-03-28): Update release artifact

## v2.2.1 (2026-03-28)
- v2.2.1: Budget UI Overhaul & Fixes

## v2.1.8 (2026-03-28)

- **fe895b6** (2026-03-28): Correct punctuation in DashboardScreen greeting and remove obsolete APK file

## v2.1.7 (2026-03-28)

- **d3d1734** (2026-03-28): feat: update greeting title in DashboardScreen to include hero suffix
- **32e5fdf** (2026-03-28): build: add Monolith-2.1.6.apk and update release script and update service logic

## v2.1.6 (2026-03-28)

- **746d2ce** (2026-03-28): standardize code formatting and indentation in DashboardScreen

## v2.1.2 (2026-03-28)

- **b5afe6a** (2026-03-28): Test - version update
- **653052c** (2026-03-28): feat: bump version to 2.1.0 and update dashboard greeting logic with ritual progress tracking
- **98c6fcf** (2026-03-28): Adds update feature in the app
- **0f871f7** (2026-03-28): updates UI for the vault screen

## v1.4.0 (2026-03-27)

- **836ba6a** (2026-03-27): feat: Revamp splash screen with new animations and background orbs, update app icon and colors, and rename Notes screen to Journal for improved clarity.
- **3eb324f** (2026-03-27): feat: Update project name to "Monolith", enhance Budget screen with grouped expense display and filtering, and refine UI/UX across various screens including Dashboard and Focus.
- **8a98d8e** (2026-03-27): feat: Introduce Agent Master Guide for Methodic Muse, detailing project identity, core functionalities, and UI/UX implementation rules.
- **cb69f72** (2026-03-27): feat: Add new features to Budget, Dashboard, Focus, Notes, Todos, and Vault screens, including currency handling, animated quotes, and enhanced note viewing and deletion functionalities.
- **0824669** (2026-03-27): feat: Update app name to "Daily Life", enhance UI with dark theme, and implement budget tracking improvements including new expense categories and animated transitions.
- **ff858ba** (2026-03-26): feat: Implement a secure dual-PIN vault with plausible deniability and auto-lock, update budget currency to INR, and add timer sound effects.
- **ed509a3** (2026-03-26): feat: Add Android media permissions, update Expo run commands, and enhance media library access and PIN registration logic.
- **ff63259** (2026-03-26): feat: Add PIN removal and settings management to Journal and Vault screens, including improved Vault item unhiding.
- **1e14832** (2026-03-26): feat: Add Budget screen, implement mood tracking for notes, and introduce a sweep function for todos.
- **0125cc7** (2026-03-26): feat: implement Focus Timer screen and enhance Tasks with priority sorting, renaming Todos tab in navigation.
- **a7cd603** (2026-03-26): v3
- **96e2580** (2026-03-26): v2
- **776f2a8** (2026-03-26): initial
