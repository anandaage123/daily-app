import {
  documentDirectory,
  getInfoAsync,
  deleteAsync,
  createDownloadResumable,
  getContentUriAsync,
  readDirectoryAsync,
  cacheDirectory,
} from 'expo-file-system/legacy';
import { Linking, Platform } from 'react-native';
import * as IntentLauncher from 'expo-intent-launcher';

// ─── Constants ────────────────────────────────────────────────────────────────
// Raw GitHub URL for the version manifest — works only if the repo is public
const VERSION_JSON_URL =
  'https://raw.githubusercontent.com/anandaage123/daily-app/master/version.json';

// These values MUST match app.json & version.json — release.sh keeps them in sync
export const APP_VERSION = '3.1.7';
export const APP_BUILD = 24;

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
    if (!res.ok) {
      console.warn(`[UpdateService] Manifest fetch failed with status: ${res.status}`);
      return null;
    }

    const manifest: VersionManifest = await res.json();
    const remoteBuild = manifest.build || manifest.versionCode || 0;

    // 1. Force update check (mandatory build requirement)
    if (manifest.minBuildRequired > APP_BUILD) {
      console.log(`[UpdateService] Update required: minBuildRequired ${manifest.minBuildRequired} > APP_BUILD ${APP_BUILD}`);
      return manifest;
    }

    // 2. Semantic version check ("2.1.8" > "2.1.7")
    if (isNewerVersion(APP_VERSION, manifest.version)) {
      console.log(`[UpdateService] New version found: ${manifest.version} > ${APP_VERSION}`);
      return manifest;
    }

    // 3. Build number check (Same version but NEWER BUILD)
    if (manifest.version === APP_VERSION && remoteBuild > APP_BUILD) {
      console.log(`[UpdateService] New build found: ${APP_VERSION} #${remoteBuild} > #${APP_BUILD}`);
      return manifest;
    }

    console.log(`[UpdateService] Already up to date: local ${APP_VERSION}#${APP_BUILD}, remote ${manifest.version}#${remoteBuild}`);
    return null;
  } catch (e) {
    console.warn('[UpdateService] Could not check for updates:', e);
    return null;
  }
}

// ─── Download Config ──────────────────────────────────────────────────────────
const APK_STORAGE_DIR = cacheDirectory ?? '';
const APK_FILENAME = 'MonolithUpdate.apk';
const APK_LOCAL_PATH = APK_STORAGE_DIR.endsWith('/') 
  ? `${APK_STORAGE_DIR}${APK_FILENAME}`
  : `${APK_STORAGE_DIR}/${APK_FILENAME}`;

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
    onStatusChange('Preparing storage…');

    // Clean up ANY existing .apk files in the cache to free space and prevent conflicts
    try {
      const files = await readDirectoryAsync(APK_STORAGE_DIR);
      for (const file of files) {
        if (file.toLowerCase().endsWith('.apk')) {
          const path = APK_STORAGE_DIR.endsWith('/') 
            ? `${APK_STORAGE_DIR}${file}`
            : `${APK_STORAGE_DIR}/${file}`;
          await deleteAsync(path, { idempotent: true });
        }
      }
    } catch (e) {
      console.warn('[UpdateService] Cleanup failed:', e);
    }

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
    
    if (!result || result.status !== 200) {
      console.warn(`[UpdateService] Download failed with status: ${result?.status}`);
      return null;
    }

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
    
    // Use expo-intent-launcher for a more robust installation intent
    await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
      data: contentUri,
      flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
      type: 'application/vnd.android.package-archive',
    });
    return;
  } catch (e) {
    console.warn('[UpdateService] Intent installation failed, falling back to browser:', e);
  }
  await Linking.openURL(releaseUrl);
}
