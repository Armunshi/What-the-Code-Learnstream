import { useCallback, useEffect, useRef, useState } from 'react';
import useDebouncedValue from '@/hooks/useDebouncedValue';
import { normalizeApiError } from '@/lib/api/errors';
import { useAuthoringStore } from '../stores/authoringStore';

/**
 * The autosave state machine from plan §2.4: idle -> saving -> saved ->
 * error (Retry) -> conflict (reload latest / overwrite).
 *
 * `save(values, editVersion)` must resolve to `{ conflict: true, current }`
 * on a 409 rather than throwing (api.js's updateCourseLearners does this) —
 * everything else it throws is treated as a plain save failure (`error`
 * state, retryable).
 *
 * The caller owns react-hook-form; this hook only watches `isDirty` +
 * `values` and calls `onSaved`/`onConflict` so the caller can `reset()` the
 * form (clearing dirty state, which is what stops this hook from re-firing —
 * there is no separate "already saved this exact value" check here).
 */
export function useAutosave({ sourceId, editVersion, isDirty, values, save, onSaved, debounceMs = 1000 }) {
  const [state, setState] = useState('idle');
  const [error, setError] = useState(null);
  const [conflictCurrent, setConflictCurrent] = useState(null);
  const debouncedValues = useDebouncedValue(values, debounceMs);
  const versionRef = useRef(editVersion);
  const savingRef = useRef(false);

  // Kept in a ref (not state) so a stale closure inside runSave never sends
  // an editVersion older than the one an in-progress conflict resolution
  // just adopted.
  versionRef.current = editVersion;

  const markDirty = useAuthoringStore((s) => s.markSourceDirty);
  const markClean = useAuthoringStore((s) => s.markSourceClean);
  const markSaving = useAuthoringStore((s) => s.markSourceSaving);
  const markSaveSettled = useAuthoringStore((s) => s.markSourceSaveSettled);

  useEffect(() => {
    if (isDirty) markDirty(sourceId);
    else markClean(sourceId);
  }, [isDirty, sourceId, markDirty, markClean]);

  // Unregister this source from the shared dirty/saving sets on unmount
  // (navigating away from the step) so a stale entry never blocks
  // navigation for a form that no longer exists.
  useEffect(
    () => () => {
      markClean(sourceId);
      markSaveSettled(sourceId);
    },
    [sourceId, markClean, markSaveSettled]
  );

  const runSave = useCallback(
    async (payload) => {
      if (savingRef.current) return;
      savingRef.current = true;
      setState('saving');
      markSaving(sourceId);
      try {
        const result = await save(payload, versionRef.current);
        if (result?.conflict) {
          setConflictCurrent(result.current);
          setState('conflict');
          return;
        }
        versionRef.current = result.course?.editVersion ?? versionRef.current + 1;
        markClean(sourceId);
        setState('saved');
        onSaved?.(result.course ?? result);
      } catch (err) {
        setError(normalizeApiError(err));
        setState('error');
      } finally {
        savingRef.current = false;
        markSaveSettled(sourceId);
      }
    },
    [save, sourceId, markSaving, markClean, markSaveSettled, onSaved]
  );

  useEffect(() => {
    if (!isDirty) return;
    // 'error'/'conflict' must wait for an explicit retry/resolve, never an
    // automatic re-attempt — without this, a caller whose `values` object
    // gets a new reference on every render (e.g. react-hook-form's watch())
    // would silently retry a failed save on its own next render.
    if (state === 'error' || state === 'conflict') return;
    runSave(debouncedValues);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deliberately NOT depending on isDirty: isDirty flips to true as soon as a keystroke lands, one render before useDebouncedValue's own 1000ms timer has actually caught up, and listing it here would fire this effect (with the still-stale debouncedValues) on that same early render instead of waiting for debouncedValues itself to change. isDirty/state are still read fresh from the closure below, just not used to *trigger* the effect.
  }, [debouncedValues]);

  const retry = useCallback(() => runSave(debouncedValues), [runSave, debouncedValues]);

  // "Overwrite": keep the instructor's unsaved edits, adopt the server's
  // version so the guarded write succeeds this time, and resend immediately.
  const overwriteConflict = useCallback(() => {
    if (!conflictCurrent) return;
    versionRef.current = conflictCurrent.editVersion;
    setConflictCurrent(null);
    runSave(debouncedValues);
  }, [conflictCurrent, debouncedValues, runSave]);

  // "Reload latest": discard the instructor's unsaved edits. `applyRemote`
  // is the caller's `form.reset(...)`-shaped callback — this hook has no
  // opinion on the form library, so it just hands the server document back.
  const reloadConflict = useCallback(
    (applyRemote) => {
      if (!conflictCurrent) return;
      versionRef.current = conflictCurrent.editVersion;
      applyRemote?.(conflictCurrent);
      setConflictCurrent(null);
      setState('idle');
      markClean(sourceId);
    },
    [conflictCurrent, sourceId, markClean]
  );

  return { state, error, conflictCurrent, retry, overwriteConflict, reloadConflict };
}

export default useAutosave;
