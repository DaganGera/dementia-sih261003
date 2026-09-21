import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'in.hillpath.app',
  appName: 'Hillpath',
  webDir: 'dist',
  android: { allowMixedContent: false },
};

export default config;
