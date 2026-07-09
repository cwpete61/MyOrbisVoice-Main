import type { CapacitorConfig } from '@capacitor/cli';

// MyOrbisAgents native shell (iOS + Android). Companion app: it loads the live
// web dashboard (server.url) inside a native WebView, and adds native push +
// biometrics on top. Because the web app is served remotely, the Capacitor
// bridge is injected into it — the web app calls plugins via window.Capacitor
// (see apps/web/src/lib/native.ts); the plugins themselves are bundled here.
const config: CapacitorConfig = {
  appId: 'com.myorbisagents.app',
  appName: 'MyOrbisAgents',
  webDir: 'www', // offline fallback only; server.url is the real app
  server: {
    url: 'https://app.myorbisagents.com',
    cleartext: false,
    // Keep in-app: OIDC login bounces through these hosts and must not open Safari.
    allowNavigation: [
      'app.myorbisagents.com',
      'api.myorbisagents.com',
      'auth.myorbisresults.com',
      'products.myorbisresults.com',
      '*.myorbisresults.com',
    ],
  },
  ios: { contentInset: 'always', backgroundColor: '#06141a' },
  android: { backgroundColor: '#06141a' },
  plugins: {
    PushNotifications: { presentationOptions: ['badge', 'sound', 'alert'] },
    SplashScreen: { launchShowDuration: 1100, backgroundColor: '#06141a', showSpinner: false },
  },
};

export default config;
