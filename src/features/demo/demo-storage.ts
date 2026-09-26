/**
 * Persistence for demo mode — deliberately minimal.
 *
 * Only a single boolean flag is persisted: whether the user is currently in
 * demo mode. This keeps a mid-demo app relaunch inside the demo experience
 * (navigation continuity) while guaranteeing that demo *data mutations* are never
 * persisted — a fresh launch always regenerates the original dataset. Demo data
 * itself lives only in memory (see `DemoStore`).
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const DEMO_FLAG_KEY = 'ledger.demoMode';

export async function loadDemoFlag(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(DEMO_FLAG_KEY)) === 'true';
  } catch {
    return false;
  }
}

export async function saveDemoFlag(active: boolean): Promise<void> {
  try {
    if (active) {
      await AsyncStorage.setItem(DEMO_FLAG_KEY, 'true');
    } else {
      await AsyncStorage.removeItem(DEMO_FLAG_KEY);
    }
  } catch {
    // Non-fatal: worst case the demo flag isn't remembered across a relaunch.
  }
}
