import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SaveConfigurationDialog } from '../dialogs/SaveConfigurationDialog';

describe('SaveConfigurationDialog', () => {
  it('hands work to the unified progress card and closes without showing a redundant study status', () => {
    const onClose = vi.fn();
    const onSave = vi.fn(() => new Promise<void>(() => undefined));

    render(<SaveConfigurationDialog isOpen onClose={onClose} onSave={onSave} />);
    fireEvent.change(screen.getByPlaceholderText(/enter a name/i), { target: { value: 'Option A' } });
    fireEvent.click(screen.getByRole('button', { name: /save and run/i }));

    expect(onSave).toHaveBeenCalledWith('Option A');
    expect(onClose).toHaveBeenCalledOnce();
    expect(screen.queryByText(/running daylight/i)).not.toBeInTheDocument();
  });
});
