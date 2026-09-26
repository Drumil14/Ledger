/// <reference types="jest" />
import { activateDemo, deactivateDemo, getDemoStore, isDemoActive } from '../demo-runtime';

const REF = new Date(2026, 5, 26, 12, 0, 0);

describe('demo runtime', () => {
  afterEach(() => deactivateDemo());

  it('is inactive by default', () => {
    expect(isDemoActive()).toBe(false);
  });

  it('throws when the store is read while inactive', () => {
    expect(() => getDemoStore()).toThrow();
  });

  it('activates with a fresh store and reports active', () => {
    const store = activateDemo(REF);
    expect(isDemoActive()).toBe(true);
    expect(getDemoStore()).toBe(store);
  });

  it('deactivates and drops the store', () => {
    activateDemo(REF);
    deactivateDemo();
    expect(isDemoActive()).toBe(false);
    expect(() => getDemoStore()).toThrow();
  });

  it('replaces the store on re-activation (fresh dataset each entry)', () => {
    const first = activateDemo(REF);
    const second = activateDemo(REF);
    expect(second).not.toBe(first);
  });
});
