import { createContext, useContext, useRef } from 'react';
import { createStore, useStore } from 'zustand';

// Local UI state for one course's authoring session (plan §2.4, C-NFR-9):
// active step, selected item, expanded sections, drag state, and which
// autosave "sources" (one per form group — currently just the learners
// step's form) are dirty or mid-save. A zustand store rather than a
// useReducer context, per §2.4: upload-progress ticks and drag state would
// otherwise re-render every context consumer, not just the ones that read
// them.
//
// One store instance per course (created fresh whenever `courseId` changes)
// via AuthoringStoreProvider — never a module-level singleton, since two
// courses being authored in two tabs must not share drag/dirty state.
export function createAuthoringStore(courseId) {
  return createStore((set) => ({
    courseId,
    activeStepId: null,
    selectedItemId: null,
    expandedSectionIds: [],
    dragState: null,

    // Every autosave-backed form group registers itself here by a stable
    // `sourceId` (e.g. "learners") so UnsavedChangesDialog / the
    // beforeunload guard can ask "is ANYTHING dirty or saving right now"
    // without knowing how many form groups exist on the current step.
    dirtySources: new Set(),
    savingSources: new Set(),

    setActiveStepId: (activeStepId) => set({ activeStepId }),
    setSelectedItemId: (selectedItemId) => set({ selectedItemId }),
    setDragState: (dragState) => set({ dragState }),
    toggleSectionExpanded: (sectionId) =>
      set((state) => ({
        expandedSectionIds: state.expandedSectionIds.includes(sectionId)
          ? state.expandedSectionIds.filter((id) => id !== sectionId)
          : [...state.expandedSectionIds, sectionId],
      })),

    markSourceDirty: (sourceId) =>
      set((state) => {
        if (state.dirtySources.has(sourceId)) return state;
        return { dirtySources: new Set(state.dirtySources).add(sourceId) };
      }),
    markSourceClean: (sourceId) =>
      set((state) => {
        if (!state.dirtySources.has(sourceId)) return state;
        const next = new Set(state.dirtySources);
        next.delete(sourceId);
        return { dirtySources: next };
      }),
    markSourceSaving: (sourceId) =>
      set((state) => ({ savingSources: new Set(state.savingSources).add(sourceId) })),
    markSourceSaveSettled: (sourceId) =>
      set((state) => {
        if (!state.savingSources.has(sourceId)) return state;
        const next = new Set(state.savingSources);
        next.delete(sourceId);
        return { savingSources: next };
      }),
  }));
}

const AuthoringStoreContext = createContext(null);

export function AuthoringStoreProvider({ courseId, children }) {
  const storeRef = useRef(null);
  if (!storeRef.current || storeRef.current.getState().courseId !== courseId) {
    storeRef.current = createAuthoringStore(courseId);
  }
  return <AuthoringStoreContext.Provider value={storeRef.current}>{children}</AuthoringStoreContext.Provider>;
}

export function useAuthoringStore(selector) {
  const store = useContext(AuthoringStoreContext);
  if (!store) {
    throw new Error('useAuthoringStore must be used within an AuthoringStoreProvider');
  }
  return useStore(store, selector);
}

// C-FR-21 "unsaved change detection": true while any registered source has
// unsaved edits OR an autosave PATCH is still in flight — the latter matters
// because "Saving…" (not yet "Saved") is exactly the window leaving-during-
// a-save must still block.
export function useIsAuthoringBusy() {
  return useAuthoringStore((state) => state.dirtySources.size > 0 || state.savingSources.size > 0);
}

export default AuthoringStoreProvider;
