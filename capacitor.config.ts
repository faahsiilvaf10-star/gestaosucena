import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.gestaosucena.app',
  appName: 'Gestao Sucena',
  webDir: '.output/public',
  server: {
    url: 'https://gestaosucena.vercel.app/equipamentos/app-motorista',
    cleartext: true
  }
};

export default config;
