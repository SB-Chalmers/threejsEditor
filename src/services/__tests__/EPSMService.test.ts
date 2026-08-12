import { describe, expect, it } from 'vitest';
import { resolveEnergyConstructions, type EPSMConstructionOptions } from '../EPSMService';

const options: EPSMConstructionOptions = {
  wall: [{ label: 'Wall A', value: 'Wall A', gwp: 1, uValue: 1 }],
  floor: [{ label: 'Floor A', value: 'Floor A', gwp: 1, uValue: 1 }],
  roof: [{ label: 'Roof A', value: 'Roof A', gwp: 1, uValue: 1 }],
  window: [{ label: 'Window A', value: 'Window A', gwp: 1, uValue: 1 }],
  byName: new Map(),
};

describe('energy construction resolution', () => {
  it('resolves default sentinels request-only and preserves valid explicit choices', () => {
    expect(resolveEnergyConstructions(options, { wall: 'Default Wall', floor: 'Floor A', roof: 'Default Roof', window: 'Default Window' })).toEqual({ wall: 'Wall A', floor: 'Floor A', roof: 'Roof A', window: 'Window A' });
  });

  it('blocks unavailable explicit choices and unavailable EPSM', () => {
    expect(() => resolveEnergyConstructions(options, { wall: 'Missing' })).toThrow(/not available/i);
    expect(() => resolveEnergyConstructions(null, {})).toThrow(/EPSM/i);
  });
});
