import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthoringStoreProvider, useAuthoringStore } from '../stores/authoringStore';
import { useAutosave } from './useAutosave';

function wrapper({ children }) {
  return <AuthoringStoreProvider courseId="course-1">{children}</AuthoringStoreProvider>;
}

// debounceMs: 0 throughout — real timers, no vi.useFakeTimers(): the
// interaction between fake timers and testing-library's own (real-timer)
// waitFor polling is a well-documented footgun, and there's nothing here
// that actually needs to assert on debounce *timing* — only on the
// resulting state transitions.
//
// `values` objects are module-level constants, not literals inline in the
// render callback: renderHook re-invokes that callback on every state
// change useAutosave itself causes, and a fresh `{...}` literal there would
// give useDebouncedValue a new reference each time — the exact "callers
// whose values object gets a new reference every render" scenario
// useAutosave's error/conflict guard exists to not auto-retry through (see
// useAutosave.js). Real callers (react-hook-form's useWatch) only produce a
// new reference when content actually changes, which these constants model.
const VALUES_A = { a: 1 };
const VALUES_V1 = { title: 'v1' };
const VALUES_MINE = { title: 'mine' };

describe('useAutosave', () => {
  it('stays idle while not dirty, and never calls save', async () => {
    const save = vi.fn();
    const { result } = renderHook(
      () => useAutosave({ sourceId: 'learners', editVersion: 0, isDirty: false, values: VALUES_A, save, debounceMs: 0 }),
      { wrapper }
    );

    expect(result.current.state).toBe('idle');
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(save).not.toHaveBeenCalled();
  });

  it('saves the debounced value once dirty, and reaches "saved"', async () => {
    const save = vi.fn().mockResolvedValue({ conflict: false, course: { editVersion: 1 } });
    const { result } = renderHook(
      () => useAutosave({ sourceId: 'learners', editVersion: 0, isDirty: true, values: VALUES_V1, save, debounceMs: 0 }),
      { wrapper }
    );

    await waitFor(() => expect(save).toHaveBeenCalledWith(VALUES_V1, 0));
    await waitFor(() => expect(result.current.state).toBe('saved'));
  });

  it('registers the source as dirty in the authoring store while unsaved, and clears it once saved', async () => {
    const save = vi.fn().mockResolvedValue({ conflict: false, course: { editVersion: 1 } });
    const useCombined = ({ isDirty }) => {
      const autosave = useAutosave({ sourceId: 'learners', editVersion: 0, isDirty, values: VALUES_A, save, debounceMs: 0 });
      const dirtySources = useAuthoringStore((s) => s.dirtySources);
      return { autosave, dirtySources };
    };

    const { result } = renderHook(useCombined, { wrapper, initialProps: { isDirty: true } });

    await waitFor(() => expect(result.current.dirtySources.has('learners')).toBe(true));
    await waitFor(() => expect(result.current.autosave.state).toBe('saved'));
    await waitFor(() => expect(result.current.dirtySources.has('learners')).toBe(false));
  });

  it('moves to "conflict" when save resolves { conflict: true }', async () => {
    const current = { editVersion: 5, title: 'server version' };
    const save = vi.fn().mockResolvedValue({ conflict: true, current });
    const { result } = renderHook(
      () => useAutosave({ sourceId: 'learners', editVersion: 0, isDirty: true, values: VALUES_MINE, save, debounceMs: 0 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.state).toBe('conflict'));
    expect(result.current.conflictCurrent).toEqual(current);
  });

  it('moves to "error" when save rejects, and retry() re-attempts it', async () => {
    const save = vi
      .fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ conflict: false, course: { editVersion: 1 } });
    const { result } = renderHook(
      () => useAutosave({ sourceId: 'learners', editVersion: 0, isDirty: true, values: VALUES_V1, save, debounceMs: 0 }),
      { wrapper }
    );

    await waitFor(() => expect(result.current.state).toBe('error'));

    await act(async () => {
      result.current.retry();
    });
    await waitFor(() => expect(result.current.state).toBe('saved'));
    expect(save).toHaveBeenCalledTimes(2);
  });
});
