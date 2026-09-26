/**
 * Demo runtime — a tiny non-React singleton that answers one question from
 * anywhere (including plain query/mutation functions that aren't hooks): is the
 * app currently in demo mode, and if so, which in-memory store backs it?
 *
 * The React `DemoProvider` owns the lifecycle and calls `activateDemo` /
 * `deactivateDemo`; the repository layer reads `isDemoActive` / `getDemoStore`
 * to route data access. Keeping this outside React means the query boundary can
 * branch without threading context through every service call.
 */

import { DemoStore } from './demo-store';

let activeStore: DemoStore | null = null;

/** True while demo mode is active. */
export function isDemoActive(): boolean {
  return activeStore !== null;
}

/** The live demo store. Throws if read while demo mode is inactive (a bug). */
export function getDemoStore(): DemoStore {
  if (!activeStore) {
    throw new Error('Demo store accessed while demo mode is inactive');
  }
  return activeStore;
}

/** Enter demo mode with a fresh, deterministic dataset. Returns the new store. */
export function activateDemo(referenceDate: Date = new Date()): DemoStore {
  activeStore = new DemoStore(referenceDate);
  return activeStore;
}

/** Leave demo mode and drop the in-memory data. */
export function deactivateDemo(): void {
  activeStore = null;
}
