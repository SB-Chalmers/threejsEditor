import { useRef } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useClickHandler } from '../useClickHandler';

const Harness = ({ onMove }: { onMove: (event: MouseEvent) => void }) => {
  const container = useRef<HTMLDivElement>(null);
  const drawing = useRef(true);
  // These callbacks change on each render, just as in SimpleBuildingCreator.
  useClickHandler(container, () => undefined, () => undefined, event => onMove(event), () => undefined, drawing);
  return <div ref={container} data-testid="viewport" />;
};

describe('viewport pointer previews', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  const flushFrame = () => act(() => {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(16));
  });

  beforeEach(() => {
    frames = new Map();
    nextFrame = 0;
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    }));
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => frames.delete(id)));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('continues previewing when a render occurs between pointer movement and the next frame', () => {
    const oldMove = vi.fn();
    const currentMove = vi.fn();
    const { getByTestId, rerender } = render(<Harness onMove={oldMove} />);
    fireEvent.mouseMove(getByTestId('viewport'), { clientX: 10, clientY: 20 });
    rerender(<Harness onMove={currentMove} />);
    fireEvent.mouseMove(getByTestId('viewport'), { clientX: 30, clientY: 40 });
    flushFrame();
    expect(oldMove).not.toHaveBeenCalled();
    expect(currentMove).toHaveBeenCalledOnce();
    expect(currentMove.mock.calls[0][0].clientX).toBe(30);
    fireEvent.mouseMove(getByTestId('viewport'), { clientX: 50, clientY: 60 });
    flushFrame();
    expect(currentMove).toHaveBeenCalledTimes(2);
  });

  it('uses the last pointer position in a frame instead of dropping it', () => {
    const onMove = vi.fn();
    const { getByTestId } = render(<Harness onMove={onMove} />);
    for (const clientX of [10, 20, 30]) fireEvent.mouseMove(getByTestId('viewport'), { clientX });
    expect(frames.size).toBe(1);
    flushFrame();
    expect(onMove).toHaveBeenCalledOnce();
    expect(onMove.mock.calls[0][0].clientX).toBe(30);
  });

  it('cancels pending movement on unmount', () => {
    const onMove = vi.fn();
    const { getByTestId, unmount } = render(<Harness onMove={onMove} />);
    fireEvent.mouseMove(getByTestId('viewport'), { clientX: 10 });
    unmount();
    flushFrame();
    expect(onMove).not.toHaveBeenCalled();
    expect(frames.size).toBe(0);
  });
});
