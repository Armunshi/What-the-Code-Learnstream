import { describe, expect, it } from 'vitest';
import { stepRegistry, getStepsByGroup, getStepById, getStepForReadinessKey, getFirstStepPath } from './registry';

describe('step registry (collected from steps/*/step.jsx)', () => {
  it('collects every step this lane ships', () => {
    const ids = stepRegistry.map((step) => step.id).sort();
    expect(ids).toEqual(['curriculum', 'learners', 'messages', 'pricing', 'promotions', 'review', 'test-video'].sort());
  });

  it('sorts by group (plan, create, publish) then by order within a group', () => {
    const groups = stepRegistry.map((step) => step.group);
    // Every 'plan' entry comes before every 'create' entry, which comes
    // before every 'publish' entry — not just "grouped somewhere".
    const firstCreateIndex = groups.indexOf('create');
    const firstPublishIndex = groups.indexOf('publish');
    const lastPlanIndex = groups.lastIndexOf('plan');
    expect(lastPlanIndex).toBeLessThan(firstCreateIndex);
    expect(groups.lastIndexOf('create')).toBeLessThan(firstPublishIndex);
  });

  it('the first step overall is the plan-group step with the lowest order', () => {
    expect(getFirstStepPath()).toBe('plan/learners');
  });

  it('getStepsByGroup groups steps under Plan/Create/Publish labels', () => {
    const grouped = getStepsByGroup();
    expect(grouped.map((g) => g.group)).toEqual(['plan', 'create', 'publish']);
    expect(grouped.find((g) => g.group === 'plan').steps.map((s) => s.id)).toContain('learners');
  });

  it('getStepById finds a step by id and returns null for an unknown one', () => {
    expect(getStepById('learners')?.path).toBe('plan/learners');
    expect(getStepById('does-not-exist')).toBeNull();
  });

  it('getStepForReadinessKey resolves a failing readiness key back to the step that fixes it', () => {
    const step = getStepForReadinessKey('learningObjectives');
    expect(step?.id).toBe('learners');
  });

  it('getStepForReadinessKey returns null for a key no step declares', () => {
    expect(getStepForReadinessKey('not-a-real-key')).toBeNull();
  });
});
