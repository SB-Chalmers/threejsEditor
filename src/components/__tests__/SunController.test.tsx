import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SunController } from '../SunController';

describe('SunController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 12, 9, 37));
  });
  afterEach(() => vi.useRealTimers());

  it('initializes once at today 14:00 and does not create real-time timers', () => {
    const interval = vi.spyOn(window, 'setInterval');
    render(<SunController isOpen onToggle={() => undefined} onSunPositionChange={() => undefined} />);
    expect(screen.getAllByText('14:00')).toHaveLength(2);
    expect(interval).not.toHaveBeenCalled();
  });

  it('supports 15-minute time changes, quick choices, and reset', () => {
    render(<SunController isOpen onToggle={() => undefined} onSunPositionChange={() => undefined} />);
    fireEvent.change(screen.getByRole('slider', { name: /time of day/i }), { target: { value: '795' } });
    expect(screen.getByText('13:15')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '17:00' }));
    expect(screen.getAllByText('17:00')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: /reset to today/i }));
    expect(screen.getAllByText('14:00')).toHaveLength(2);
  });
});
