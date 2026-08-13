import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { BuildingData } from '../../types/building';
import { createBuildingEditDraft, type BuildingEditDraft } from '../../hooks/useBuildingEditSession';
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

const ControlledPanel = ({
  initialDraft,
  onCommit,
  onCancel,
}: {
  initialDraft: BuildingEditDraft;
  onCommit: (draft: BuildingEditDraft) => void;
  onCancel: () => void;
}) => {
  const [draft, setDraft] = useState(initialDraft);
  const [baseDraft] = useState(initialDraft);
  return (
    <BuildingEditPanel
      draft={draft}
      baseDraft={baseDraft}
      onChange={setDraft}
      onReset={() => setDraft(baseDraft)}
      onCommit={() => onCommit(draft)}
      onCancel={onCancel}
    />
  );
};

const setup = (building = makeBuilding()) => {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  const view = render(
    <ControlledPanel
      initialDraft={createBuildingEditDraft(building)}
      onCommit={onCommit}
      onCancel={onCancel}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: /form & massing/i }));
  return { ...view, onCommit, onCancel };
};

describe('BuildingEditPanel controlled draft', () => {
  it('renders updates from the parent-owned draft', () => {
    setup();
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '8' } });
    expect((screen.getAllByRole('slider')[0] as HTMLInputElement).value).toBe('8');
    expect(screen.getByText('24.0 m')).toBeInTheDocument();
  });

  it('commits the latest controlled slider value', () => {
    const { onCommit } = setup();
    fireEvent.change(screen.getAllByRole('slider')[2], { target: { value: '0.83' } });
    fireEvent.click(screen.getByRole('button', { name: /done/i }));
    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit.mock.calls[0][0].window_to_wall_ratio).toBe(0.83);
  });

  it('resets to the panel-opening draft', () => {
    setup(makeBuilding('building-a', 3));
    fireEvent.change(screen.getAllByRole('slider')[0], { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: /reset/i }));
    expect((screen.getAllByRole('slider')[0] as HTMLInputElement).value).toBe('3');
  });

  it.each([
    ['Cancel button', () => screen.getByRole('button', { name: /^cancel$/i })],
    ['X button', () => screen.getByRole('button', { name: /cancel building edits/i })],
    ['backdrop', () => screen.getByTestId('building-edit-backdrop')]
  ])('%s delegates cancellation', (_label, getControl) => {
    const { onCancel } = setup();
    fireEvent.click(getControl());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('renders a reinstated same-id draft without retaining the previous floor value', () => {
    const callbacks = { onChange: vi.fn(), onReset: vi.fn(), onCommit: vi.fn(), onCancel: vi.fn() };
    const tenFloors = createBuildingEditDraft(makeBuilding('building-a', 10));
    const sixFloors = createBuildingEditDraft(makeBuilding('building-a', 6));
    const { rerender } = render(
      <BuildingEditPanel draft={tenFloors} baseDraft={tenFloors} {...callbacks} />
    );
    fireEvent.click(screen.getByRole('button', { name: /form & massing/i }));
    expect((screen.getAllByRole('slider')[0] as HTMLInputElement).value).toBe('10');

    rerender(<BuildingEditPanel draft={sixFloors} baseDraft={sixFloors} {...callbacks} />);
    expect((screen.getAllByRole('slider')[0] as HTMLInputElement).value).toBe('6');
  });
});
