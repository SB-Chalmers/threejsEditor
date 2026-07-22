import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DaylightResultsDialog } from '../DaylightResultsDialog';
import type { DaylightRunSummary } from '../../../types/daylight';

const makeResult = (overrides: Partial<DaylightRunSummary> = {}): DaylightRunSummary => ({
  studyId: 'study-1',
  status: 'complete',
  sensorCount: 1,
  meanDF: 12,
  sda: 60,
  points: [{ x: 0, y: 0, z: 0, value: 12 }],
  startedAt: '2025-01-01T00:00:00.000Z',
  ...overrides
});

describe('DaylightResultsDialog', () => {
  it('renders a result selector when multiple results are available', () => {
    const handleSelect = vi.fn();

    render(
      <DaylightResultsDialog
        isOpen
        onClose={() => undefined}
        buildingName="Building A"
        result={makeResult()}
        availableResults={[
          { id: 'building-a', name: 'Building A' },
          { id: 'building-b', name: 'Building B' }
        ]}
        selectedBuildingId="building-a"
        onSelectBuildingResult={handleSelect}
        onApplyVisualization={() => undefined}
      />
    );

    const selector = screen.getByLabelText(/result building/i);
    expect(selector).toBeInTheDocument();

    fireEvent.change(selector, { target: { value: 'building-b' } });

    expect(handleSelect).toHaveBeenCalledWith('building-b');
  });
});
