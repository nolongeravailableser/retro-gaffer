import { test, expect } from '@playwright/test';

/**
 * The core loop, end to end, as a brand-new player:
 * onboard → sign a squad → ready → kick off → full-time → back to the squad.
 * A fresh browser context = empty localStorage = first-run onboarding.
 */
test('core loop: onboard → sign → kick off → full-time', async ({ page }) => {
  await page.goto('/');

  // First-run onboarding appears; skip straight to the game.
  await page.getByTestId('skip-onboarding').click();

  // Journey stage 1: SIGN. The CTA routes to the Transfers tab (a fresh first
  // run lands on Tactics), then Auto-Sign + refresh until the stage advances.
  const cta = page.getByTestId('kickoff-cta');
  await expect(cta).toContainText('Sign players');
  await cta.click(); // → Transfers
  await expect(page.getByTestId('refresh-shop')).toBeVisible();
  for (let i = 0; i < 12; i++) {
    if (!(await cta.innerText()).includes('Sign players')) break;
    await page.getByTestId('journey-helper').click();
    await page.waitForTimeout(200);
    await page.getByTestId('refresh-shop').click();
    await page.waitForTimeout(200);
  }
  await expect(cta).toContainText('Play Round 1');

  // Stage 3: KICK OFF. First click routes to the Season tab, second launches.
  await cta.click();
  await expect(cta).toContainText('Kick off');
  await cta.click();

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

  // Close the match: the run has advanced (round 2) or ended visibly.
  await page.getByLabel('Close match').click();
  await expect(page.getByTestId('kickoff-cta')).toBeVisible();
});
