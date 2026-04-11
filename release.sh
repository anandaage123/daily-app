#!/bin/bash
# ╔══════════════════════════════════════════════════════════════════════╗
# ║              Monolith — Interactive Release Script                  ║
# ║  Just run: ./release.sh  — it will guide you through everything     ║
# ╚══════════════════════════════════════════════════════════════════════╝

set -e

# ─── Colors ──────────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; BLUE='\033[0;34m'
YELLOW='\033[1;33m'; CYAN='\033[0;36m'; BOLD='\033[1m'
DIM='\033[2m'; MAGENTA='\033[0;35m'; RESET='\033[0m'

info()    { echo -e "${CYAN}  ▸${RESET} $1"; }
success() { echo -e "${GREEN}  ✓${RESET} $1"; }
warn()    { echo -e "${YELLOW}  ⚠${RESET}  $1"; }
error()   { echo -e "${RED}  ✗${RESET}  $1"; exit 1; }
dim()     { echo -e "${DIM}    $1${RESET}"; }

divider() {
  echo -e "${DIM}  ────────────────────────────────────────────────${RESET}"
}

header() {
  echo ""
  echo -e "${BOLD}${BLUE}  ══ $1 ══${RESET}"
  echo ""
}

banner() {
  clear
  echo ""
  echo -e "${BOLD}${MAGENTA}  ███╗   ███╗ ██████╗ ███╗   ██╗ ██████╗ ██╗     ██╗████████╗██╗  ██╗${RESET}"
  echo -e "${BOLD}${MAGENTA}  ████╗ ████║██╔═══██╗████╗  ██║██╔═══██╗██║     ██║╚══██╔══╝██║  ██║${RESET}"
  echo -e "${BOLD}${BLUE}  ██╔████╔██║██║   ██║██╔██╗ ██║██║   ██║██║     ██║   ██║   ███████║${RESET}"
  echo -e "${BOLD}${BLUE}  ██║╚██╔╝██║██║   ██║██║╚██╗██║██║   ██║██║     ██║   ██║   ██╔══██║${RESET}"
  echo -e "${BOLD}${CYAN}  ██║ ╚═╝ ██║╚██████╔╝██║ ╚████║╚██████╔╝███████╗██║   ██║   ██║  ██║${RESET}"
  echo -e "${BOLD}${CYAN}  ╚═╝     ╚═╝ ╚═════╝ ╚═╝  ╚═══╝ ╚═════╝ ╚══════╝╚═╝   ╚═╝   ╚═╝  ╚═╝${RESET}"
  echo ""
  echo -e "  ${DIM}Release Automation Tool${RESET}"
  echo ""
  divider
  echo ""
}

# ─── Show banner ──────────────────────────────────────────────────────────────
banner

# ─── Step 1: Check prerequisites ─────────────────────────────────────────────
header "Checking Prerequisites"

MISSING_TOOLS=()

command -v node  &>/dev/null && success "Node.js found" || MISSING_TOOLS+=("node")
command -v git   &>/dev/null && success "Git found"    || MISSING_TOOLS+=("git")

if command -v adb &>/dev/null; then
  success "ADB found (device install enabled)"
  ADB_AVAILABLE=true
else
  warn "ADB not found — device install will be skipped"
  ADB_AVAILABLE=false
fi

if command -v gh &>/dev/null; then
  success "GitHub CLI (gh) found — automated release enabled"
  GH_AVAILABLE=true
else
  warn "GitHub CLI not found — you will need to upload APK manually"
  GH_AVAILABLE=false
fi

if [[ ${#MISSING_TOOLS[@]} -gt 0 ]]; then
  echo ""
  error "Missing required tools: ${MISSING_TOOLS[*]}"
fi

echo ""

# ─── Step 2: Read current version ────────────────────────────────────────────
header "Current App State"

CURRENT_VERSION=$(node -p "require('./app.json').expo.version" 2>/dev/null || echo "0.0.0")
CURRENT_BUILD=$(node -p "(require('./version.json').build || 0)" 2>/dev/null || echo "0")
NEW_BUILD=$((CURRENT_BUILD + 1))

# Split current semver
IFS='.' read -r CUR_MAJOR CUR_MINOR CUR_PATCH <<< "$CURRENT_VERSION"

# Pre-compute options
VER_PATCH="${CUR_MAJOR}.${CUR_MINOR}.$((CUR_PATCH + 1))"
VER_MINOR="${CUR_MAJOR}.$((CUR_MINOR + 1)).0"
VER_MAJOR="$((CUR_MAJOR + 1)).0.0"

echo -e "  Current version : ${BOLD}${CURRENT_VERSION}${RESET}  ${DIM}(build #${CURRENT_BUILD})${RESET}"
echo -e "  Next build #    : ${BOLD}${NEW_BUILD}${RESET}"
echo ""

# ─── Step 3: Choose version ──────────────────────────────────────────────────
header "Choose Release Version"

echo -e "  ${BOLD}1)${RESET} Patch   ${CYAN}→ ${VER_PATCH}${RESET}  ${DIM}(bug fixes, small tweaks)${RESET}"
echo -e "  ${BOLD}2)${RESET} Minor   ${CYAN}→ ${VER_MINOR}${RESET}  ${DIM}(new features, backward compatible)${RESET}"
echo -e "  ${BOLD}3)${RESET} Major   ${CYAN}→ ${VER_MAJOR}${RESET}  ${DIM}(breaking changes, major overhaul)${RESET}"
echo -e "  ${BOLD}4)${RESET} Custom  ${CYAN}→ type your own version number${RESET}"
echo ""

while true; do
  echo -ne "  ${BOLD}Your choice [1/2/3/4]:${RESET} "
  read -r VERSION_CHOICE

  case "$VERSION_CHOICE" in
    1) NEW_VERSION="$VER_PATCH"; break ;;
    2) NEW_VERSION="$VER_MINOR"; break ;;
    3) NEW_VERSION="$VER_MAJOR"; break ;;
    4)
      echo -ne "  Enter version number (e.g. 2.5.0): "
      read -r CUSTOM_VERSION
      if [[ "$CUSTOM_VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
        NEW_VERSION="$CUSTOM_VERSION"
        break
      else
        warn "Invalid format. Use x.y.z (e.g. 2.0.1)"
      fi
      ;;
    *)
      warn "Please enter 1, 2, 3, or 4"
      ;;
  esac
done

RELEASE_DATE=$(date +%Y-%m-%d)
TAG="v${NEW_VERSION}"

success "Selected: ${BOLD}${NEW_VERSION}${RESET}  ${DIM}(tagged as ${TAG})${RESET}"
echo ""

header "Deployment Goal: Connected Device + GitHub"
info "Building with Gradle and side-loading update to your connected device."
echo ""

# ─── Step 4: Release notes ───────────────────────────────────────────────────
header "Release Notes"

echo -e "  ${DIM}What changed in this release? Enter one item per line.${RESET}"
echo -e "  ${DIM}Press ENTER on a blank line when done.${RESET}"
echo ""

NOTES_LINES=()
while true; do
  echo -ne "  ${CYAN}+${RESET} "
  read -r NOTE_LINE
  [[ -z "$NOTE_LINE" ]] && break
  NOTES_LINES+=("• $NOTE_LINE")
done

if [[ ${#NOTES_LINES[@]} -eq 0 ]]; then
  warn "No notes entered — using default"
  NOTES_LINES=("• Bug fixes and improvements")
fi

RELEASE_NOTES_TEXT=$(printf '%s\n' "${NOTES_LINES[@]}")
echo ""
echo -e "  ${GREEN}Release notes saved:${RESET}"
printf '    %s\n' "${NOTES_LINES[@]}"
echo ""

# ─── Step 5: Confirm ─────────────────────────────────────────────────────────
header "Release Summary"

divider
echo ""
echo -e "  ${BOLD}Version    :${RESET}  ${CURRENT_VERSION}  →  ${GREEN}${BOLD}${NEW_VERSION}${RESET}"
echo -e "  ${BOLD}Build #    :${RESET}  ${CURRENT_BUILD}  →  ${GREEN}${BOLD}${NEW_BUILD}${RESET}"
echo -e "  ${BOLD}Tag        :${RESET}  ${TAG}"
echo -e "  ${BOLD}APK name   :${RESET}  Monolith.apk"
echo -e "  ${BOLD}Release URL:${RESET}  ${DIM}https://github.com/anandaage123/daily-app/releases/tag/${TAG}${RESET}"
echo ""
divider
echo ""
if [[ "$GH_AVAILABLE" == true ]]; then
  echo -e "    4. ${CYAN}Create GitHub Release${RESET} and upload APK"
else
  echo -e "    4. ${YELLOW}Skip GitHub Release${RESET}"
fi
echo -e "    5. ${CYAN}Install APK${RESET} on connected Android Studio device via Gradle"
echo ""

while true; do
  echo -ne "  ${BOLD}Proceed with release? [y/N]:${RESET} "
  read -r CONFIRM
  case "$CONFIRM" in
    y|Y|yes|YES) break ;;
    n|N|no|NO|"") echo ""; warn "Release cancelled."; exit 0 ;;
    *) warn "Please enter y or n" ;;
  esac
done

echo ""
echo -e "  ${GREEN}${BOLD}Starting release…${RESET}"
echo ""

# ─── Step 6: Update version files ────────────────────────────────────────────
header "Updating Version Files"

# app.json
node -e "
  const fs = require('fs');
  const json = JSON.parse(fs.readFileSync('app.json', 'utf8'));
  json.expo.version = '${NEW_VERSION}';
  json.expo.android = json.expo.android || {};
  json.expo.android.versionCode = ${NEW_BUILD};
  fs.writeFileSync('app.json', JSON.stringify(json, null, 2) + '\n');
"
success "app.json → version ${NEW_VERSION}, versionCode ${NEW_BUILD}"

# package.json
node -e "
  const fs = require('fs');
  const json = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  json.version = '${NEW_VERSION}';
  fs.writeFileSync('package.json', JSON.stringify(json, null, 2) + '\n');
"
success "package.json → version ${NEW_VERSION}"

# UpdateService.ts — baked into the APK at build time
sed -i '' "s/export const APP_VERSION = '.*';/export const APP_VERSION = '${NEW_VERSION}';/" \
  src/services/UpdateService.ts
sed -i '' "s/export const APP_BUILD = [0-9]*;/export const APP_BUILD = ${NEW_BUILD};/" \
  src/services/UpdateService.ts
success "UpdateService.ts → APP_VERSION '${NEW_VERSION}', APP_BUILD ${NEW_BUILD}"

# android/app/build.gradle (Native versioning)
GRADLE_FILE="android/app/build.gradle"
if [[ -f "$GRADLE_FILE" ]]; then
  sed -i '' "s/versionCode [0-9]*/versionCode ${NEW_BUILD}/" "$GRADLE_FILE"
  sed -i '' "s/versionName \".*\"/versionName \"${NEW_VERSION}\"/" "$GRADLE_FILE"
  success "build.gradle → versionName \"${NEW_VERSION}\", versionCode ${NEW_BUILD}"
fi

echo ""

# ─── Step 7: Build & Install to Device ────────────────────────────────────────
header "Building & Installing"
info "Running: cd android && ./gradlew installRelease"
info "By using Gradle directly, we skip slow pre-checks and update the device immediately."
echo ""

cd android && ./gradlew installRelease
cd ..

# Find APK
APK_SOURCE=$(find android/app/build/outputs/apk/release -name "*.apk" 2>/dev/null | head -n 1)
if [[ -z "$APK_SOURCE" ]]; then
  error "APK not found. Build may have failed."
fi

# Clean up old APKs first
rm -f *.apk

DEST_APK="Monolith.apk"
cp "$APK_SOURCE" "$DEST_APK"
APK_SIZE=$(du -sh "$DEST_APK" | cut -f1)

success "APK built: ${BOLD}${DEST_APK}${RESET}  ${DIM}(${APK_SIZE})${RESET}"
echo ""

# ─── Step 8: Update version.json ─────────────────────────────────────────────
header "Updating version.json"

DOWNLOAD_URL="https://github.com/anandaage123/daily-app/releases/download/${TAG}/Monolith.apk"
RELEASE_URL="https://github.com/anandaage123/daily-app/releases/tag/${TAG}"

python3 - "$NEW_VERSION" "$NEW_BUILD" "$RELEASE_DATE" "$RELEASE_NOTES_TEXT" "$DOWNLOAD_URL" "$RELEASE_URL" <<'PYEOF'
import sys, json
v, b, d, notes, dw, rl = sys.argv[1:7]
manifest = {
    "version": v,
    "build": int(b),
    "versionCode": int(b),
    "releaseDate": d,
    "releaseNotes": notes.strip(),
    "downloadUrl": dw,
    "releaseUrl": rl,
    "minBuildRequired": 1,
    "forceUpdate": False
}
with open("version.json", "w") as f:
    json.dump(manifest, f, indent=2)
    f.write("\n")
PYEOF

success "version.json updated"
dim "Download URL: ${DOWNLOAD_URL}"
echo ""

# ─── Step 9: Git commit & tag ────────────────────────────────────────────────
header "Committing & Tagging"

git add app.json package.json version.json src/services/UpdateService.ts

# Stage the APK if you want it tracked (optional; usually skipped)
# git add "${DEST_APK}"  # uncomment if you want APK in git (not recommended for large files)

git commit -m "release: Bump version to ${NEW_VERSION}
$(printf '%s\n' "${NOTES_LINES[@]}")"

git tag -a "${TAG}" -m "Monolith ${NEW_VERSION}
$(printf '%s\n' "${NOTES_LINES[@]}")"

success "Committed: release: Bump version to ${NEW_VERSION}"
success "Tagged: ${TAG}"
echo ""

header "Pushing to GitHub"
git push origin master
success "Pushed master branch"
git push origin "${TAG}"
success "Pushed tag ${TAG}"
echo ""

# ─── Step 11: Create GitHub Release ──────────────────────────────────────────
header "Creating GitHub Release"

if [[ "$GH_AVAILABLE" == true ]]; then
  info "Uploading APK to GitHub Releases…"
  gh release create "${TAG}" \
    "${DEST_APK}" \
    --title "Monolith ${NEW_VERSION}" \
    --notes "$(printf '%s\n' "${NOTES_LINES[@]}")" \
    --repo "anandaage123/daily-app"
  success "GitHub Release created!"
  success "APK live at: ${DIM}${DOWNLOAD_URL}${RESET}"
else
  warn "GitHub CLI not available — skipping GitHub Release"
fi
echo ""

# ─── Step 12: Install to device ──────────────────────────────────────────────
header "Installing to Device"

success "Installed via gradlew installRelease"
echo ""

# ─── Done ────────────────────────────────────────────────────────────────────
divider
echo ""
echo -e "  ${BOLD}${GREEN}🎉 Release ${NEW_VERSION} is live!${RESET}"
echo ""
echo -e "  ${BOLD}Version :${RESET} ${NEW_VERSION}"
echo -e "  ${BOLD}APK     :${RESET} ${DEST_APK}  ${DIM}(${APK_SIZE})${RESET}"
echo -e "  ${BOLD}Tag     :${RESET} ${TAG}"
echo -e "  ${BOLD}URL     :${RESET} ${DIM}${RELEASE_URL}${RESET}"
echo ""
echo -e "  ${DIM}Users on an older version will see the update prompt${RESET}"
echo -e "  ${DIM}the next time they open the app.${RESET}"
echo ""
divider
echo ""
