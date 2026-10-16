import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gestaosucena.appmotorista',
  appName: 'App Motorista',
  webDir: 'dist-motorista',
  // SEM server.url — assets carregados localmente do APK (funciona offline!)
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
  }
};

export default config;
