# ZannyPay UI and transaction-flow remediation checklist

**Baseline:** main branch at the time this checklist was created.
**Build policy:** Do not trigger another Expo/EAS build until code checks pass, local frontend/browser acceptance checks are completed by the owner, and the checklist's build gate is explicitly cleared.
**Design sources:** Supplied ZannyPay brand artwork and the 3-page PDF reference. Preserve the original logo and icons. PDF page 1 is the compact dashboard/navigation reference; page 2 is the bill and mobile top-up reference; page 3 is the card-management reference.

## 1. Brand system and splash
- [ ] Replace the green-led primary palette with a logo-matched midnight navy / cyan-blue system.
- [ ] Keep green for success/positive financial states; retain clear warning and error colours.
- [ ] Audit hard-coded purple/green colours in screens, gradients, receipts, charts and controls.
- [ ] Preserve supplied original logo, launcher icon, adaptive icon and splash artwork.
- [ ] Check contrast, focus/pressed/disabled states and dark-mode consistency.

## 2. Dashboard layout
- [ ] Rework dashboard hierarchy to match PDF page 1: greeting/profile, wallet balance, Add Money and Transfer, savings/earnings strip, service shortcuts, promo/insight cards, recent activity.
- [ ] Remove mismatched or overly crowded dashboard blocks.
- [ ] Verify balance masking, pull-to-refresh, empty/loading/error states and all shortcut destinations.

## 3. Bottom navigation
- [ ] Match the PDF reference's five-tab information architecture: Home, Wealth, Finance, Rewards, Me.
- [ ] Improve active indicator, icon/label spacing, safe-area and touch targets.
- [ ] Test navigation state and nested screen back behaviour.

## 4. Card screen and statements
- [ ] Replace narrow wrapping Card Services grid with responsive readable rows/cards.
- [ ] Fix statement labels, columns, amount alignment, long references and small-screen PDF output.
- [ ] Validate card activity, limits, freeze/reveal/default actions and empty/loading states.
- [ ] Do not imply card issuance is live unless an issuing partner is configured.

## 5. Airtime and data
- [ ] Replace the inert contact glyph with a real permission-aware contact picker and graceful denial/manual-entry fallback.
- [ ] Load provider/service catalogue and data variations from the verified provider, not hard-coded plan prices.
- [ ] Implement phone validation, network detection/selection, amount/plan selection, PIN confirmation and idempotent purchase.
- [ ] Show pending/success/failed outcomes and requery/reversal behaviour accurately.
- [ ] Keep purchase submission disabled until a provider adapter is configured and sandbox tests pass.

## 6. Bills
- [ ] Load live service categories and provider catalogue from the provider.
- [ ] Add customer/meter/account validation before purchase.
- [ ] Implement confirmation, idempotent purchase, pending status, requery, receipt and definitive-failure reversal.
- [ ] Keep money movement gated until VTpass sandbox credentials and end-to-end smoke tests are verified.
- [ ] Never debit a wallet for an unavailable or unverified service.

## 7. Transaction history and receipts
- [ ] Normalize backend transaction type/status/amount/fee/reference/recipient fields.
- [ ] Correct receipt branding and layout; handle long references and small screens.
- [ ] Distinguish pending, processing, successful/completed, failed, reversed and refunded states.
- [ ] Ensure transaction list, detail, receipt, PDF export and share use the same source data.
- [ ] Requery pending provider transactions safely; never label pending as successful.

## 8. Add Money
- [ ] Trace amount input -> validation -> backend funding initialization -> Paystack checkout -> app return -> server verification -> wallet sync.
- [ ] Fix any modal/keyboard/checkout deep-link or return-session issue found.
- [ ] Test pending recovery, resume checkout, manual status check, idempotency and duplicate-payment protection.
- [ ] Verify only server-confirmed successful NGN payments credit the wallet.
- [ ] Use sandbox/test credentials only for acceptance; never perform a live charge without explicit approval.

## 9. Automated and integration validation
- [ ] Mobile Jest suite.
- [ ] Expo config validation and dependency compatibility check.
- [ ] Static checks/lint and Android bundle/prebuild validation without EAS build quota usage where possible.
- [ ] Backend tests for airtime, VTpass bill purchase, funding, transaction reconciliation and ledger invariants.
- [ ] Confirm API base URL, auth, CORS/web session constraints and provider feature flags.
- [ ] Confirm no secret values are logged or exposed.

## 10. Local acceptance and final build gate
- [ ] Owner runs the updated frontend from the local `zannypay-frontend` checkout.
- [ ] Open the local web build in the owner's browser and check dashboard, tabs, card, statements, airtime, bills, receipts and Add Money.
- [ ] Run the Android app on a physical device or emulator for native-only flows (contacts, SecureStore, Paystack return).
- [ ] Record defects and fix them before approving the final build.
- [ ] Only after all checks pass: use one controlled EAS APK build and verify the downloadable artifact.

## Findings at baseline
- The current theme's primary colour is emerald `#00D99A`; dark surfaces are green-tinted rather than the supplied brand navy.
- Airtime screen hard-codes `AIRTIME_AND_DATA_LIVE = false`; its contact glyph is not a pressable control.
- Bills screen hard-codes `BILL_PAYMENTS_LIVE = false`; provider categories are shown as coming soon.
- Backend comments/state indicate no production airtime/data adapter is wired. VTpass bill purchases require both `VTPASS_BILL_PAYMENTS_ENABLED=true` and `VTPASS_SANDBOX_VERIFIED=true`.
- Add Money already has a Paystack initialization/verification/pending-recovery flow; the reported issue needs a traced reproduction rather than a blind rewrite.
- Card Services currently uses a narrow wrapping grid; receipt styles still contain older purple/black brand colours.
- The previous branding-only APK workflow run succeeded, but this is not acceptance of the requested UI/transaction fixes. No further EAS build should be run until this checklist's gate is met.
