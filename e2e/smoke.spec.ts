import { test, expect } from '@playwright/test';

/**
 * The core loop, end to end, as a brand-new player — through the real front
 * door: onboard → Start Menu → new career (difficulty) → kick off MW1 →
 * full-time → back to the squad. A fresh browser context = empty localStorage
 * = first-run onboarding, then the Start Menu.
 */
test('core loop: onboard → new career → kick off → full-time', async ({ page }) => {
  await page.goto('/');

  // First-run onboarding appears; skip straight to the Start Menu.
  await page.getByTestId('skip-onboarding').click();

  // Front door: New career → difficulty picker (Standard pre-selected) → start.
  await page.getByTestId('menu-new-career').click();
  await page.getByTestId('start-pending-mode').click();

  // A first career shows the one-time guided tour (fresh context = empty
  // localStorage); skip it so it doesn't drive the tab for us.
  const tourSkip = page.getByTestId('career-tour-skip');
  if (await tourSkip.isVisible().catch(() => false)) await tourSkip.click();

  // A new career fields a legal grey-unknowns XI automatically — the journey
  // CTA reads "Start Season 1". Depending on the landing tab it may route once
  // before it plays, so click until the match actually opens.
  const cta = page.getByTestId('kickoff-cta');
  await expect(cta).toContainText('Start Season 1');
  const pitch = page.getByTestId('match-pitch');
  for (let i = 0; i < 3 && !(await pitch.isVisible().catch(() => false)); i++) {
    await cta.click();
    await page.waitForTimeout(200);
  }

  // The 2D pitch view renders. Skip ahead — the interactive match pauses for
  // decisions (half-time talk, possible substitution), so answer each one.
  await expect(page.getByTestId('match-pitch')).toBeVisible();
  for (let i = 0; i < 6; i++) {
    if (await page.getByText(/VICTORY|DEFEAT|DRAW/).isVisible().catch(() => false)) break;
    const instant = page.getByTitle('Skip to full-time');
    if (await instant.isVisible().catch(() => false)) await instant.click();
    await page.waitForTimeout(400);
    if (await page.getByTestId('talk-steady').isVisible().catch(() => false)) {
      await page.getByTestId('talk-steady').click();
    }
    if (await page.getByTestId('sub-none').isVisible().catch(() => false)) {
      await page.getByTestId('sub-none').click();
    }
  }
  await expect(page.getByText(/VICTORY|DEFEAT|DRAW/)).toBeVisible();

  // Close the match: the run has advanced (matchweek 2) with the CTA back.
  await page.getByLabel('Close match').click();
  await expect(page.getByTestId('kickoff-cta')).toBeVisible();
});
