import {
  documentDirectory,
  getInfoAsync,
  deleteAsync,
  createDownloadResumable,
  getContentUriAsync,
} from 'expo-file-system/legacy';
import { Linking, Platform } from 'react-native';

// ─── Constants ────────────────────────────────────────────────────────────────
// Raw GitHub URL for the version manifest — works only if the repo is public
const VERSION_JSON_URL =
  'https://raw.githubusercontent.com/anandaage123/daily-app/master/version.json';

// These values MUST match app.json & version.json — release.sh keeps them in sync
export const APP_VERSION = '2.0.0';
export const APP_BUILD = 1;

// ─── Types ────────────────────────────────────────────────────────────────────
export interface VersionManifest {
  version: string;
  build: number;
  versionCode: number;
  releaseDate: string;
  releaseNotes: string;
  downloadUrl: string;
  releaseUrl: string;
  minBuildRequired: number;
  forceUpdate: boolean;
}

export type DownloadProgress = {
  totalBytesWritten: number;
  totalBytesExpectedToWrite: number;
};

// ─── Semver comparison ────────────────────────────────────────────────────────
/**
 * Returns true if remoteVersion is strictly newer than localVersion.
 * Handles standard semantic versioning: "2.1.0" > "2.0.3" > "2.0.0"
 */
export function isNewerVersion(localVersion: string, remoteVersion: string): boolean {
  const local = localVersion.split('.').map(Number);
  const remote = remoteVersion.split('.').map(Number);
  for (let i = 0; i < Math.max(local.length, remote.length); i++) {
    const l = local[i] ?? 0;
    const r = remote[i] ?? 0;
    if (r > l) return true;
    if (r < l) return false;
  }
  return false;
}

// ─── Check for updates ────────────────────────────────────────────────────────
/**
 * Fetches version.json from GitHub raw and returns the manifest if an update
 * is available, or null if we're already on the latest version.
 */
export async function checkForUpdates(): Promise<VersionManifest | null> {
  try {
    const res = await fetch(VERSION_JSON_URL, {
      headers: { 'Cache-Control': 'no-cache' },
    });
    if (!res.ok) return null;

    const manifest: VersionManifest = await res.json();

    // Force update: our build is below the minimum required
    if (manifest.minBuildRequired > APP_BUILD) return manifest;

    // Standard semver bump check
    if (isNewerVersion(APP_VERSION, manifest.version)) return manifest;

    return null;
  } catch (e) {
    console.warn('[UpdateService] Could not check for updates:', e);
    return null;
  }
}

// ─── Download APK ─────────────────────────────────────────────────────────────
const APK_LOCAL_PATH = (documentDirectory ?? '') + 'MonolithUpdate.apk';

/**
 * Downloads the APK from downloadUrl with real-time progress callbacks.
 * Returns the local file URI on success, or null on failure.
 */
export async function downloadUpdate(
  downloadUrl: string,
  onProgress: (progress: number) => void,
  onStatusChange: (status: string) => void
): Promise<string | null> {
  try {
    onStatusChange('Preparing download…');

    // Clean up any previous partial download
    try {
      const existing = await getInfoAsync(APK_LOCAL_PATH);
      if (existing.exists) {
        await deleteAsync(APK_LOCAL_PATH, { idempotent: true });
      }
    } catch (_) { /* no-op */ }

    onStatusChange('Downloading…');

    const downloadResumable = createDownloadResumable(
      downloadUrl,
      APK_LOCAL_PATH,
      {},
      (downloadProgress: DownloadProgress) => {
        const { totalBytesWritten, totalBytesExpectedToWrite } = downloadProgress;
        if (totalBytesExpectedToWrite > 0) {
          onProgress(totalBytesWritten / totalBytesExpectedToWrite);
        }
      }
    );

    const result = await downloadResumable.downloadAsync();
    if (!result || result.status !== 200) return null;

    onProgress(1);
    onStatusChange('Ready to install');
    return result.uri;
  } catch (e) {
    console.warn('[UpdateService] Download failed:', e);
    return null;
  }
}

// ─── Trigger Install ─────────────────────────────────────────────────────────
/**
 * Attempts to open the downloaded APK for installation.
 * On Android 7+: uses getContentUriAsync for a FileProvider-based install intent.
 * Fallback: opens the GitHub release page in the browser.
 */
export async function triggerInstall(
  localUri: string,
  releaseUrl: string
): Promise<void> {
  if (Platform.OS !== 'android') {
    await Linking.openURL(releaseUrl);
    return;
  }
  try {
    const contentUri = await getContentUriAsync(localUri);
    const canOpen = await Linking.canOpenURL(contentUri);
    if (canOpen) {
      await Linking.openURL(contentUri);
      return;
    }
  } catch (e) {
    console.warn('[UpdateService] Content URI install failed, falling back to browser:', e);
  }
  await Linking.openURL(releaseUrl);
}
