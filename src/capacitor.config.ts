import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "tr.com.dersbende.enstitu",
  appName: "e-Nstitü",
  webDir: "dist",
  backgroundColor: "#ffffff",
  android: {
    backgroundColor: "#ffffff",
    allowMixedContent: false,
  },
  ios: {
    backgroundColor: "#ffffff",
    contentInset: "automatic",
  },
  server: {
    androidScheme: "https",
    iosScheme: "capacitor",
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1200,
      launchAutoHide: true,
      backgroundColor: "#ffffff",
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
    },
  },
};

export default config;
