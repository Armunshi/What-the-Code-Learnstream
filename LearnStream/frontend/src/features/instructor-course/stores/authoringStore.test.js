import { describe, expect, it } from 'vitest';
import { createAuthoringStore } from './authoringStore';

// The vanilla zustand store's own logic (dirty/saving source tracking,
// active step, expanded sections) is plain state-machine code testable
// without mounting React — the context/provider wiring is exercised
// indirectly by every step page's own tests instead.
describe('createAuthoringStore', () => {
  it('starts with no dirty or saving sources', () => {
    const store = createAuthoringStore('course-1');
    expect(store.getState().dirtySources.size).toBe(0);
    expect(store.getState().savingSources.size).toBe(0);
  });

  it('tracks a dirty source until it is marked clean', () => {
    const store = createAuthoringStore('course-1');
    store.getState().markSourceDirty('learners');
    expect(store.getState().dirtySources.has('learners')).toBe(true);

    store.getState().markSourceClean('learners');
    expect(store.getState().dirtySources.has('learners')).toBe(false);
  });

  it('tracks a saving source independently of the dirty set', () => {
    const store = createAuthoringStore('course-1');
    store.getState().markSourceDirty('learners');
    store.getState().markSourceSaving('learners');
    store.getState().markSourceClean('learners'); // a successful save clears dirty...

    expect(store.getState().dirtySources.has('learners')).toBe(false);
    expect(store.getState().savingSources.has('learners')).toBe(true); // ...but the request may still be in flight

    store.getState().markSourceSaveSettled('learners');
    expect(store.getState().savingSources.has('learners')).toBe(false);
  });

  it('toggles a section id in and out of expandedSectionIds', () => {
    const store = createAuthoringStore('course-1');
    store.getState().toggleSectionExpanded('section-1');
    expect(store.getState().expandedSectionIds).toEqual(['section-1']);

    store.getState().toggleSectionExpanded('section-1');
    expect(store.getState().expandedSectionIds).toEqual([]);
  });

  it('two stores for different courses never share state', () => {
    const storeA = createAuthoringStore('course-a');
    const storeB = createAuthoringStore('course-b');

    storeA.getState().markSourceDirty('learners');
    expect(storeB.getState().dirtySources.size).toBe(0);
  });
});
