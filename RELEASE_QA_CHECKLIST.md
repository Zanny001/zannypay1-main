# ZannyPay Release QA Checklist

Last reviewed: 2026-11-26
Mobile repository: `Zanny001/zannypay1-main`
Backend repository: `Zanny001/zannypay-backend`

This checklist is the release source of truth. A code change or successful bundle export is not the same as a successful end-to-end payment test. Do not mark a provider live until its sandbox transaction, status requery, idempotency, and reversal paths pass.

## 1. Brand and dashboard

- [x] Use the supplied ZannyPay logo artwork in the dashboard header.
- [x] Configure launcher icon, Android adaptive icon, splash artwork and web favicon.
- [x] Move the app identity to midnight navy / cyan-blue; reserve green for positive financial states.
- [x] Rework the dashboard hierarchy around wallet balance, add money, send money, shortcuts, card promotion and recent transactions.
- [x] Align primary tabs to Home, Cards, Scan & Pay, History and Profile.
- [x] Make the Data shortcut open the Data Bundle tab.
- [ ] Verify the visual layout on a small Android handset, a larger handset and a browser viewport.
- [ ] Confirm every dashboard tile navigates to the intended screen.

## 2. Cards and statements

- [x] Adjust ZannyPay card face to the navy/cyan palette.
- [x] Reduce card number and cardholder text clipping using responsive text sizing.
- [x] Improve statement HTML escaping and responsive table layout.
- [ ] Verify statements with long names, long references, empty history and large transaction lists.
- [ ] Verify card controls, reveal/hide and empty states on device.

## 3. Transactions and receipts

- [x] Normalize transaction status to successful, pending or failed in the receipt.
- [x] Escape dynamic receipt fields and allow long values to wrap.
- [x] Add fee and recipient account details where available.
- [x] Add visible status labels to history rows.
- [ ] Test transfer -> history -> receipt navigation.
- [ ] Test incoming credit, outgoing debit, pending, failed and reversed receipt variants.
- [ ] Confirm receipt amount, fee, reference, timestamp and beneficiary against backend records.
- [ ] Confirm PDF/share/print behaviour on Android and web.

## 4. Add Money / Paystack

- [x] Improve loading/error handling around funding initialization and verification.
- [x] Preserve pending reference recovery and prevent duplicate checkout attempts.
- [ ] Run a controlled Paystack test-mode payment end-to-end.
- [ ] Confirm the authenticated verify endpoint and webhook settle the same reference exactly once.
- [ ] Test abandoned checkout, delayed webhook, duplicate callback, network loss and retry.
- [ ] Verify wallet balance and double-entry ledger after success and after non-success.
- [ ] Do not use a live customer charge as a test without explicit approval.

## 5. Airtime and data

- [x] Make the contact icon open a permission-aware contact picker.
- [x] Copy the selected contact number into the recipient field.
- [x] Ensure dashboard Data shortcut selects Data Bundle.
- [ ] Connect a contracted airtime/data fulfilment provider and use its live product catalogue.
- [ ] Replace static plan prices with provider catalogue prices.
- [ ] Verify recipient phone, network, product/variation and amount server-side.
- [ ] Test idempotency, delayed provider response, requery, definitive failure and refund.
- [ ] Keep purchase and wallet debit disabled until provider sandbox tests pass.

## 6. Bills / VTpass

- [x] Add authenticated VTpass catalogue, variation and customer-verification endpoints.
- [x] Add idempotent purchase lifecycle, ledger reservation, pending requery and definitive-failure reversal.
- [ ] Verify sandbox API credentials and catalogue/variation responses.
- [ ] Verify account validation for electricity and TV billers.
- [ ] Complete sandbox purchase, requery, duplicate retry and refund/reversal tests.
- [ ] Only after those tests pass, explicitly enable both `VTPASS_BILL_PAYMENTS_ENABLED=true` and `VTPASS_SANDBOX_VERIFIED=true`.
- [ ] Keep both flags false until sandbox verification is documented.
- [ ] Replace static “coming soon” roadmap categories with actual supported catalogue entries; do not present unsupported billers as available.

## 7. Local acceptance before release

- [x] CI dependency installation and Jest checks passed for the redesign branch.
- [x] CI Android Expo export passed for the redesign branch.
- [x] CI web Expo export passed for the redesign branch.
- [ ] Pull the merged `main` branch into the user's local `zannypay-frontend` checkout.
- [ ] Run local dependency install and Expo config validation.
- [ ] Start the local web export/server and inspect it in the user's browser.
- [ ] Start the app on a physical Android device with Expo Go or a development build.
- [ ] Exercise login, wallet, add money, transfers, history, receipts, cards, statements, QR, airtime and bills.
- [ ] Record defects, fix them, and rerun CI before APK release.

## 8. Android release build

- [ ] Confirm merged-main CI checks pass.
- [ ] Confirm local browser and Android acceptance tests pass.
- [ ] Confirm no unresolved critical/high defects.
- [ ] Confirm app version/versionCode and EAS project configuration.
- [ ] Trigger the final EAS APK build only after the preceding checks are signed off.
- [ ] Install APK on a physical Android device and run smoke tests.
- [ ] Archive build URL, commit SHA, test evidence and release notes.

## Current safety gates

Airtime/data and bill purchases are not considered live merely because the screens or API routes exist. Provider fulfilment must be verified before a wallet debit can be enabled. Paystack Add Money also requires a controlled end-to-end test before production sign-off.

Local terminal and physical-device testing require the user's local machine and phone; remote repository CI cannot substitute for those tests.
