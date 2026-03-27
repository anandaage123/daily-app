# Methodic Muse - Agent Master Guide

## 1. Project Identity & Design System
**Methodic Muse** is a minimalist, high-focus productivity ecosystem.
- **Theme:** Dark-mode elegance. High contrast whites on deep slates and purples.
- **Palette (`MM_Colors`):**
    - `primary`: `#4052B6` (Royal Muse Blue)
    - `primaryLight`: `#8899FF`
    - `background`: `#F9F5FF` (Soft UI background)
    - `surface`: `#FFFFFF`
    - `text`: `#2C2A51` (Deep Slate)
    - `secondary`: `#765600` (Gold)
    - `tertiary`: `#006947` (Green)
    - `error`: `#B41340` (Ruby)

## 2. File & Functionality Registry

### Core
- `App.tsx`: Entry point with `StatusBar` and `AppNavigator`.
- `src/navigation/AppNavigator.tsx`: Bottom Tab navigation (Dashboard, Tasks, Wallet, Focus, Journal) and Stack navigation for auth-protected Vault.
- `src/theme/Theme.ts`: Central source of truth for colors and typography.

### Features (`src/screens/`)
- **Dashboard (`DashboardScreen.tsx`)**:
    - **Rituals:** Persistent habits (`@habits_v3`). Toggle & Long-press delete.
    - **Quotes:** Fetched from DummyJSON API. Interactive swipe (PanResponder) with spring animations.
    - **Atmosphere:** GPS weather widget. Uses `expo-location` and Open-Meteo.
    - **Metrics:** Real-time progress bars for habits and wallet health.
    - **Vault Entry:** Long-press (2s) on "Daily Hub" logo.
- **Deep Focus (`FocusScreen.tsx`)**:
    - **Timer:** Pomodoro engine with custom Work/Break timings.
    - **Zen Mode:** Pulse animation (scale 1.0 <-> 1.1) synchronized with breathing labels.
    - **Audio:** `expo-audio` for session completion.
- **Tasks (`TodosScreen.tsx`)**:
    - **Ledger:** Priority-based tasking. Long-press to set "Primary Focus".
    - **Sweep:** Custom confirmation modal to clear tasks.
- **Curated Journal (`NotesScreen.tsx`)**:
    - **Security:** 6-digit PIN gate.
    - **Musings:** Entry creation with mood emojis, category tags, and full-text search.
    - **Export:** Sharing ledger via system share sheet.
- **Secure Vault (`VaultScreen.tsx`)**:
    - **Encryption:** Dual identities (Primary vs Decoy PINs).
    - **Storage:** Secure media gallery (Images/Videos) and Password Manager.
    - **Gallery:** Fullscreen native video playback (`expo-video`).
- **Daily Wallet (`BudgetScreen.tsx`)**:
    - **History:** Date-grouped `SectionList`.
    - **Logic:** `Balance = Limit - Expenses + Income`.
    - **Localization:** Auto-symbol detection via Dashboard location sync.

## 3. UI/UX Implementation Rules
- **Scrolling:** ROOT containers must use `flex: 1`. 
    - Use `contentContainerStyle={{ flexGrow: 1 }}` in `ScrollView` to ensure centering.
    - **Avoid hardcoded bottom spacers** (e.g., `<View style={{height: 40}}/>`) that cause excessive scroll beyond content.
    - If content fits exactly (e.g., Auth screens), disable scrolling or use a simple `View`.
- **Backgrounds:** Ensure root views have proper background colors to prevent black gaps during bounce.
- **Interactivity:** Quotes are swiped, habits are toggled, focus is set via long-press.
- **Performance:** Always use `useNativeDriver: true` for `Animated` API calls.
- **Persistence:** All data goes through `AsyncStorage` with specific namespaced keys.
