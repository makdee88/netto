import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';

export const GDRIVE_TOKEN_KEY = 'netto_gdrive_token';
const GDRIVE_EXPIRES_KEY = 'netto_gdrive_token_expires';

const GOOGLE_CLIENT_ID =
  ((import.meta as any).env?.VITE_GOOGLE_CLIENT_ID as string) ||
  'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';

const REDIRECT_URI = `${window.location.origin}/oauth/gdrive.html`;

/**
 * Returns stored Google Drive access token if valid and unexpired
 */
export function getStoredGoogleDriveToken(): string | null {
  const token = sessionStorage.getItem(GDRIVE_TOKEN_KEY);
  const expiresAt = sessionStorage.getItem(GDRIVE_EXPIRES_KEY);

  if (!token) return null;
  if (expiresAt && Date.now() > Number(expiresAt)) {
    sessionStorage.removeItem(GDRIVE_TOKEN_KEY);
    sessionStorage.removeItem(GDRIVE_EXPIRES_KEY);
    return null;
  }
  return token;
}

/**
 * Caches token and computes expiration
 */
export function storeGoogleDriveToken(token: string, expiresInSeconds = 3599) {
  sessionStorage.setItem(GDRIVE_TOKEN_KEY, token);
  const expiresAt = Date.now() + (expiresInSeconds - 60) * 1000;
  sessionStorage.setItem(GDRIVE_EXPIRES_KEY, String(expiresAt));
}

/**
 * Builds standard Google OAuth2 Implicit Flow URL requesting drive.appdata scope
 */
export function buildGoogleDriveAuthUrl(): string {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: 'token',
    scope: 'https://www.googleapis.com/auth/drive.appdata',
    prompt: 'consent',
    include_granted_scopes: 'true',
  });

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/**
 * Initiates the Google Drive OAuth flow across native wrapper or web
 */
export async function launchGoogleDriveAuth(): Promise<string | null> {
  const authUrl = buildGoogleDriveAuthUrl();

  if (Capacitor.isNativePlatform()) {
    // Native APK: Open system Chrome Custom Tab
    await Browser.open({ url: authUrl, windowName: '_self' });
    return null; // Completed asynchronously via appUrlOpen listener in App.tsx
  }

  // Web Browser: Open popup window and await postMessage response
  return new Promise<string>((resolve, reject) => {
    const width = 500;
    const height = 650;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const popup = window.open(
      authUrl,
      'NettoGoogleAuth',
      `width=${width},height=${height},left=${left},top=${top},status=0,menubar=0`
    );

    if (!popup) {
      reject(new Error('Popup blocked. Please allow popups for Netto.'));
      return;
    }

    const messageHandler = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;

      if (event.data?.type === 'NETTO_GDRIVE_AUTH') {
        window.removeEventListener('message', messageHandler);
        const hash = (event.data.hash || '').replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const token = params.get('access_token');
        const expiresIn = Number(params.get('expires_in') || '3600');

        if (token) {
          storeGoogleDriveToken(token, expiresIn);
          resolve(token);
        } else {
          reject(new Error('No access token returned from Google'));
        }
      }
    };

    window.addEventListener('message', messageHandler);
  });
}