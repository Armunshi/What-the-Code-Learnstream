import type { Page } from '@playwright/test';

// Learn/player-page selectors, matching the `data-testid`s in
// frontend/src/features/learn/** and features/my-learning/**. Kept here
// rather than inline in specs so a future learn-player.spec.ts or
// my-learning.spec.ts (plan doc, not yet required by this wave's DoD) can
// reuse them instead of re-deriving the same locators.

export function getCurriculumSidebar(page: Page) {
  return page.getByTestId('curriculum-sidebar');
}

export function getCurriculumItem(page: Page, itemId: string) {
  return page.locator(`[data-testid="curriculum-item"][data-item-id="${itemId}"]`);
}

export function getMarkCompleteButton(page: Page) {
  return page.getByTestId('mark-complete-button');
}

export function getSpeedMenuTrigger(page: Page) {
  return page.getByTestId('speed-menu-trigger');
}

export function getCaptionsMenuTrigger(page: Page) {
  return page.getByTestId('captions-menu-trigger');
}

export function getTranscriptCues(page: Page) {
  return page.getByTestId('transcript-cue');
}

export function getAutoplayCountdown(page: Page) {
  return page.getByTestId('autoplay-countdown');
}

export function getMyLearningCards(page: Page) {
  return page.getByTestId('my-learning-card');
}

export function getMyLearningTab(page: Page, tab: 'all' | 'in_progress' | 'completed') {
  return page.getByTestId(`my-learning-tab-${tab}`);
}
