#!/bin/bash
# ╔═══════════════════════════════════════════════════════════════════╗
# ║            Monolith — Release Automation Script                   ║
# ║  Usage: ./release.sh [patch|minor|major|x.y.z]                   ║
# ║  Example: ./release.sh patch      → 2.0.0 → 2.0.1               ║
# ║  Example: ./release.sh minor      → 2.0.0 → 2.1.0               ║
# ║  Example: ./release.sh 2.5.0      → set version to 2.5.0         ║
# ╚═══════════════════════════════════════════════════════════════════╝

set -e  # Exit immediately on error

# ────────────────────────────────────────────────────────────────────
# 1. COLORS & HELPERS
# ────────────────────────────────────────────────────────────────────
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

info()    { echo -e "${CYAN}▸${RESET} $1"; }
success() { echo -e "${GREEN}✓${RESET} $1"; }
warn()    { echo -e "${YELLOW}⚠${RESET}  $1"; }
error()   { echo -e "${RED}✗${RESET}  $1"; exit 1; }
section() { echo -e "\n${BOLD}${BLUE}━━━ $1 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}"; }

section "Monolith Release Tool"

# ────────────────────────────────────────────────────────────────────
# 2. REQUIRE ARGUMENT
# ────────────────────────────────────────────────────────────────────
BUMP_TYPE="${1:-patch}"

if [[ -z "$BUMP_TYPE" ]]; then
  error "Usage: ./release.sh [patch|minor|major|x.y.z]"
fi

# ────────────────────────────────────────────────────────────────────
# 3. COMPUTE NEW VERSION
# ────────────────────────────────────────────────────────────────────
section "Computing Version"

CURRENT_VERSION=$(node -p "require('./app.json').expo.version")
CURRENT_BUILD=$(node -p "
  const v = require('./version.json');
  v.build || 1
")
NEW_BUILD=$((CURRENT_BUILD + 1))

info "Current version : ${CURRENT_VERSION} (build ${CURRENT_BUILD})"

# Split semver
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1)); PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
  [0-9]*.[0-9]*.[0-9]*)
    IFS='.' read -r MAJOR MINOR PATCH <<< "$BUMP_TYPE"
    ;;
  *)
    error "Invalid bump type: '$BUMP_TYPE'. Use patch|minor|major or x.y.z"
    ;;
esac

NEW_VERSION="${MAJOR}.${MINOR}.${PATCH}"
RELEASE_DATE=$(date +%Y-%m-%d)
TAG="v${NEW_VERSION}"

success "New version: ${NEW_VERSION} (build ${NEW_BUILD})"

# ────────────────────────────────────────────────────────────────────
# 4. PROMPT FOR RELEASE NOTES
# ────────────────────────────────────────────────────────────────────
section "Release Notes"

echo -e "${YELLOW}Enter release notes (one item per line).${RESET}"
echo -e "${YELLOW}Press ENTER twice when done:${RESET}\n"

NOTES_LINES=()
while IFS= read -r line; do
  [[ -z "$line" ]] && break
  NOTES_LINES+=("• $line")
done

if [[ ${#NOTES_LINES[@]} -eq 0 ]]; then
  warn "No release notes entered. Using default."
  NOTES_LINES=("• Bug fixes and improvements")
fi

RELEASE_NOTES=$(printf '%s\n' "${NOTES_LINES[@]}")
echo -e "\n${GREEN}Release Notes:${RESET}"
printf '%s\n' "${NOTES_LINES[@]}"

# ────────────────────────────────────────────────────────────────────
# 5. UPDATE VERSION FILES
# ────────────────────────────────────────────────────────────────────
section "Updating Version Files"

# Update app.json
node -e "
  const fs = require('fs');
  const json = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  json.expo.version = '${NEW_VERSION}';
  json.expo.android = json.expo.android || {};
  json.expo.android.versionCode = ${NEW_BUILD};
  fs.writeFileSync('app.json', JSON.stringify(json, null, 2) + '\n');
  console.log('  app.json updated');
"

# Update package.json
node -e "
  const fs = require('fs');
  const json = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  json.version = '${NEW_VERSION}';
  fs.writeFileSync('package.json', JSON.stringify(json, null, 2) + '\n');
  console.log('  package.json updated');
"

# Update src/services/UpdateService.ts — the constants baked into the APK
sed -i '' "s/export const APP_VERSION = '.*';/export const APP_VERSION = '${NEW_VERSION}';/" \
  src/services/UpdateService.ts
sed -i '' "s/export const APP_BUILD = .*;/export const APP_BUILD = ${NEW_BUILD};/" \
  src/services/UpdateService.ts

success "Source version constants updated"

# version.json is updated AFTER APK build (we need the download URL)
info "version.json will be updated after APK is built"

# ────────────────────────────────────────────────────────────────────
# 6. BUILD RELEASE APK
# ────────────────────────────────────────────────────────────────────
section "Building Release APK"

info "Running: npx expo run:android --variant release"
npx expo run:android --variant release

# Locate built APK
APK_PATH=$(find android/app/build/outputs/apk/release -name "*.apk" 2>/dev/null | head -n 1)

if [[ -z "$APK_PATH" ]]; then
  error "APK build failed — no .apk file found in android/app/build/outputs/apk/release"
fi

# Copy to project root with versioned name
DEST_APK="Monolith-${NEW_VERSION}.apk"
cp "$APK_PATH" "$DEST_APK"
APK_SIZE=$(du -sh "$DEST_APK" | cut -f1)

success "APK built: ${DEST_APK} (${APK_SIZE})"

# ────────────────────────────────────────────────────────────────────
# 7. UPDATE version.json (with final download URL)
# ────────────────────────────────────────────────────────────────────
section "Updating version.json"

DOWNLOAD_URL="https://github.com/anandaage123/daily-app/releases/download/${TAG}/${DEST_APK}"
RELEASE_URL="https://github.com/anandaage123/daily-app/releases/tag/${TAG}"

# Escape newlines for JSON
NOTES_JSON=$(printf '%s\n' "${NOTES_LINES[@]}" | python3 -c "
import sys, json
lines = sys.stdin.read().rstrip()
print(json.dumps(lines)[1:-1])  # strip surrounding quotes
")

node -e "
  const fs = require('fs');
  const manifest = {
    version: '${NEW_VERSION}',
    build: ${NEW_BUILD},
    versionCode: ${NEW_BUILD},
    releaseDate: '${RELEASE_DATE}',
    releaseNotes: '${NOTES_JSON}',
    downloadUrl: '${DOWNLOAD_URL}',
    releaseUrl: '${RELEASE_URL}',
    minBuildRequired: 1,
    forceUpdate: false
  };
  fs.writeFileSync('version.json', JSON.stringify(manifest, null, 2) + '\n');
  console.log('  version.json updated');
"

success "version.json updated → points to ${DOWNLOAD_URL}"

# ────────────────────────────────────────────────────────────────────
# 8. GIT COMMIT & TAG
# ────────────────────────────────────────────────────────────────────
section "Git Commit & Tag"

git add app.json package.json version.json src/services/UpdateService.ts
git commit -m "release: Bump version to ${NEW_VERSION} (build ${NEW_BUILD})"
git tag -a "${TAG}" -m "Release ${NEW_VERSION}"

success "Committed and tagged: ${TAG}"

# ────────────────────────────────────────────────────────────────────
# 9. PUSH TO GITHUB
# ────────────────────────────────────────────────────────────────────
section "Pushing to GitHub"

git push origin master
git push origin "${TAG}"

success "Pushed to GitHub (master + ${TAG})"

# ────────────────────────────────────────────────────────────────────
# 10. CREATE GITHUB RELEASE (requires gh CLI)
# ────────────────────────────────────────────────────────────────────
section "Creating GitHub Release"

if command -v gh &> /dev/null; then
  info "GitHub CLI found — creating release with APK upload"

  NOTES_BODY=$(printf '%s\n' "${NOTES_LINES[@]}")

  gh release create "${TAG}" \
    "${DEST_APK}" \
    --title "Monolith ${NEW_VERSION}" \
    --notes "${NOTES_BODY}" \
    --repo "anandaage123/daily-app"

  success "GitHub release created: ${RELEASE_URL}"
  success "APK uploaded: ${DOWNLOAD_URL}"

else
  warn "GitHub CLI (gh) not found. Release was NOT created automatically."
  echo ""
  echo -e "${BOLD}Manual steps:${RESET}"
  echo "  1. Go to: https://github.com/anandaage123/daily-app/releases/new"
  echo "  2. Select tag: ${TAG}"
  echo "  3. Title: Monolith ${NEW_VERSION}"
  echo "  4. Upload APK: ${DEST_APK}"
  echo "  5. Publish release"
  echo ""
  echo -e "${YELLOW}Once published, the app will auto-detect update v${NEW_VERSION}.${RESET}"
  echo ""
  info "Install 'gh' for fully automated releases: brew install gh && gh auth login"
fi

# ────────────────────────────────────────────────────────────────────
# 11. OPTIONAL: ADB INSTALL
# ────────────────────────────────────────────────────────────────────
section "Installing to Device"

if command -v adb &> /dev/null; then
  DEVICE=$(adb devices | grep -v "List of devices" | grep "device$" | head -n 1)
  if [[ -n "$DEVICE" ]]; then
    info "Device found — installing ${DEST_APK}…"
    adb install -r "$DEST_APK"
    success "Installed on device"
  else
    warn "No Android device connected via ADB. Skipping install."
  fi
else
  warn "adb not in PATH — skipping device install."
fi

# ────────────────────────────────────────────────────────────────────
# DONE
# ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}┌─────────────────────────────────────────────┐${RESET}"
echo -e "${BOLD}${GREEN}│   Release ${NEW_VERSION} complete! 🎉              │${RESET}"
echo -e "${BOLD}${GREEN}├─────────────────────────────────────────────┤${RESET}"
echo -e "${BOLD}${GREEN}│  Tag    :  ${TAG}                          ${GREEN}│${RESET}"
echo -e "${BOLD}${GREEN}│  APK    :  ${DEST_APK}          ${GREEN}│${RESET}"
echo -e "${BOLD}${GREEN}│  Size   :  ${APK_SIZE}                              ${GREEN}│${RESET}"
echo -e "${BOLD}${GREEN}└─────────────────────────────────────────────┘${RESET}"
