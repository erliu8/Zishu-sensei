/**
 * useClickOutside Hook 单元测试
 */

import { describe, it, expect, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { useClickOutside } from '../useClickOutside';

describe('useClickOutside', () => {
  it('should call handler when clicking outside element', () => {
    const handler = vi.fn();
    const ref = { current: document.createElement('div') };
    document.body.appendChild(ref.current);

    renderHook(() => useClickOutside(ref, handler));

    // Click outside
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(ref.current);
    document.body.removeChild(outsideElement);
  });

  it('should not call handler when clicking inside element', () => {
    const handler = vi.fn();
    const ref = { current: document.createElement('div') };
    document.body.appendChild(ref.current);

    renderHook(() => useClickOutside(ref, handler));

    // Click inside
    ref.current.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(ref.current);
  });

  it('should handle touch events', () => {
    const handler = vi.fn();
    const ref = { current: document.createElement('div') };
    document.body.appendChild(ref.current);

    renderHook(() => useClickOutside(ref, handler));

    // Touch outside
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    outsideElement.dispatchEvent(new TouchEvent('touchstart', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);

    document.body.removeChild(ref.current);
    document.body.removeChild(outsideElement);
  });

  it('should not call handler when disabled', () => {
    const handler = vi.fn();
    const ref = { current: document.createElement('div') };
    document.body.appendChild(ref.current);

    renderHook(() => useClickOutside(ref, handler, false));

    // Click outside
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(ref.current);
    document.body.removeChild(outsideElement);
  });

  it('should handle null ref', () => {
    const handler = vi.fn();
    const ref = { current: null };

    renderHook(() => useClickOutside(ref, handler));

    // Click anywhere
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('should clean up event listeners on unmount', () => {
    const handler = vi.fn();
    const ref = { current: document.createElement('div') };
    document.body.appendChild(ref.current);

    const { unmount } = renderHook(() => useClickOutside(ref, handler));

    unmount();

    // Click outside after unmount
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler).not.toHaveBeenCalled();

    document.body.removeChild(ref.current);
    document.body.removeChild(outsideElement);
  });

  it('should update handler on re-render', () => {
    const handler1 = vi.fn();
    const handler2 = vi.fn();
    const ref = { current: document.createElement('div') };
    document.body.appendChild(ref.current);

    const { rerender } = renderHook(
      ({ handler }) => useClickOutside(ref, handler),
      { initialProps: { handler: handler1 } }
    );

    // Click outside with first handler
    const outsideElement = document.createElement('div');
    document.body.appendChild(outsideElement);
    outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).not.toHaveBeenCalled();

    // Update handler
    rerender({ handler: handler2 });

    // Click outside with second handler
    outsideElement.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);

    document.body.removeChild(ref.current);
    document.body.removeChild(outsideElement);
  });
});

