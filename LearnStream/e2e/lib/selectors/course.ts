import type { Page, Locator } from '@playwright/test';

// Course-list / catalog / course-detail-page selectors (W1-CAT). Scoped to
// the `data-testid`s the new features/catalog and features/course
// components render, rather than CSS classes, so these survive styling
// changes the way `.no-scrollbar button` (the pre-CAT selector this
// replaces) never could.

export function courseGrid(page: Page): Locator {
  return page.getByTestId('course-grid');
}

export function courseCards(page: Page): Locator {
  return page.getByTestId('course-card');
}

export function categoryTabs(page: Page): Locator {
  return page.getByTestId('category-tabs');
}

export function categoryTab(page: Page, label: string): Locator {
  return page.getByTestId('category-tab').filter({ hasText: label });
}

export function curriculumAccordion(page: Page): Locator {
  return page.getByTestId('curriculum-accordion');
}

export function curriculumItems(page: Page): Locator {
  return page.getByTestId('curriculum-item');
}

export function previewItemButtons(page: Page): Locator {
  return page.getByTestId('preview-item-button');
}
