import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { BuildingData } from '../../types/building';
import { BuildingEditPanel } from '../BuildingEditPanel';

vi.mock('../../services/EPSMService', () => ({
  getEPSMConstructionOptions: vi.fn(() => Promise.resolve({ wall: [], floor: [], roof: [], window: [] })),
  calculateEmbodiedCarbon: vi.fn(() => null)
}));

const makeBuilding = (id = 'building-a', floors = 3): BuildingData => ({
  id,
  mesh: { userData: {}, material: {} } as BuildingData['mesh'],
  points: [{ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, { x: 10, y: 0, z: 8 }, { x: 0, y: 0, z: 8 }],
  footprintArea: 80,
  metrics: { footprintArea: 80, grossFloorArea: 80 * floors, perimeter: 36, totalHeight: floors * 3 },
  floors,
  floorHeight: 3,
  color: 0x3b82f6,
  createdAt: new Date(),
  window_to_wall_ratio: 0.4,
  window_overhang: false,
  window_overhang_depth: 0.5
});

const setup = (building = makeBuilding()) => {
  const onPreview = vi.fn();
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <BuildingEditPanel
      building={building}
      onPreview={onPreview}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /form & massing/i }));
  return { ...view, onPreview, onCommit, onCancel };
};

describe('BuildingEditPanel draft transaction', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('debounces visual previews without committing canonical data', () => {
    const { onPreview, onCommit } = setup();
    const wwr = screen.getAllByRole('slider')[2];

    fireEvent.change(wwr, { target: { value: '0.6' } });
    fireEvent.change(wwr, { target: { value: '0.7' } });
    expect(onPreview).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(50));

    expect(onPreview).toHaveBeenCalledTimes(1);
    expect(onPreview.mock.calls[0][0].window_to_wall_ratio).toBe(0.7);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Done commits the latest slider value even before its preview timer fires', () => {
    const { onPreview, onCommit } = setup();
    fireEvent.change(screen.getAllByRole('slider')[2], { target: { value: '0.83' } });
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    act(() => vi.runAllTimers());

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].window_to_wall_ratio).toBe(0.83);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('Reset restores the panel-opening snapshot and previews it immediately', () => {
    const { onPreview } = setup(makeBuilding('building-a', 3));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '8' } });
    act(() => vi.advanceTimersByTime(50));
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));

    expect(onPreview.mock.calls.at(-1)?.[0].floors).toBe(3);
    expect((screen.getAllByRole('slider')[0] as HTMLInputElement).value).toBe('3');
  });

  it.each([
    ['Cancel button', () => screen.getByRole('button', { name: /^cancel$/i })],
    ['X button', () => screen.getByRole('button', { name: /cancel building edits/i })],
    ['backdrop', () => screen.getByTestId('building-edit-backdrop')]
  ])('%s cancels pending preview work and rolls back through onCancel', (_label, getControl) => {
    const { onPreview, onCancel } = setup();
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '9' } });
    fireEvent.click(getControl());
    act(() => vi.runAllTimers());

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onPreview).not.toHaveBeenCalled();
  });

  it('expires a pending draft and reinitializes when the selected building changes', () => {
    const { rerender, onPreview, onCommit, onCancel } = setup(makeBuilding('building-a', 3));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '12' } });
    rerender(
      <BuildingEditPanel
        building={makeBuilding('building-b', 6)}
        onPreview={onPreview}
        onCommit={onCommit}
        onCancel={onCancel}
      />
    );
    act(() => vi.runAllTimers());

    expect(onPreview).not.toHaveBeenCalled();
    expect((screen.getAllByRole('slider')[0] as HTMLInputElement).value).toBe('6');
  });
});
