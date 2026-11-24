# Zannypay — A PalmPay-style Mobile Wallet

A polished React Native (Expo) fintech app: wallet balance, bank transfers, bill/airtime
payments, invoicing, virtual cards, rewards, analytics, transaction history, PIN + biometric
login, and onboarding — connected to a real backend API over HTTPS.

## ⚠️ Important: what this is and isn't

The UI, navigation, and wallet logic in this app talk to a real backend endpoint
(`EXPO_PUBLIC_API_URL`, defaulting to `https://zannypay-backend.onrender.com/api/v1`) for
authentication, balance, and transactions. If that backend isn't deployed/running yet, auth
calls will fail — this app is the front-end half of a real product, not a mocked demo.

The app is connected to the ZannyPay NestJS API, but a connected screen is not automatically a
live financial service. Production safeguards deliberately block capabilities that still lack
approved providers or funded facilities.

Current integration boundaries:
- **Wallet, internal transfers, bank-directory/account-name lookup, transaction history,
  beneficiaries, savings goals, budgets, invoices, disputes and recurring-transfer workflows**
  have backend APIs. External bank payouts still require a live payout provider and end-to-end
  reconciliation before they can be enabled.
- **Phone OTP and email verification** are not part of the current signup flow. Signup currently
  collects details, then a PIN, then an optional referral code. Phone OTP enforcement remains
  disabled until a real delivery provider is approved and the mobile flow is updated.
- **Virtual card issuing, BVN/NIN/liveness verification, airtime/data/bill fulfilment and lending**
  do not have production provider integrations. The backend rejects mock success in production.
- **Savings goals** support deposits and withdrawals. Production savings interest is paused until
  there is a contracted, funded yield source and the required approvals.
- **Rewards** use backend-tracked daily check-ins and points. Points are not cash and should not
  be advertised as redeemable money unless a funded redemption program exists.
- **Developer Console** is development-only illustrative UI. It does not issue real API keys or
  create production credentials.

A live money-moving launch still requires the appropriate Nigerian regulatory authorization or
licensed partners, real provider approvals, operational controls, fraud monitoring, reconciliation,
customer support, and independent security/compliance review. Do not treat test-mode credentials
or a configured environment variable as proof that a service is production-ready.

## Tech stack

- **Expo (React Native, SDK 54)** — cross-platform, works in Snack or on-device via Expo Go.
- **React Navigation** — stack + bottom tabs.
- **A real backend API** (NestJS-shaped responses assumed) for auth, wallet balance, and
  transactions, called from `src/services/apiClient.js`.
- **AsyncStorage** — local cache/offline-first layer, so the app is usable and shows the last
  known balance/history even with no connection.
- **expo-secure-store** — JWT auth token storage, and (optionally) an on-device PIN used only
  to unlock biometric login.
- **expo-local-authentication** — Face ID / Touch ID / fingerprint login.
- **expo-linear-gradient**, **@expo/vector-icons** — the visual polish.

## Offline behavior

The app can display cached, previously fetched information when connectivity is lost.
Financial mutations (transfers, wallet funding, bill payments and other money movement) fail
closed while offline: they are **never queued for automatic replay** and no USSD fallback is
claimed. Users must reconnect, review the details and submit the transaction again.

## Running it — free options

### Option A: Expo Snack (fastest, zero install)
1. Go to https://snack.expo.dev
2. Create a new Snack, then delete its default files.
3. Recreate this folder structure inside Snack (upload each file's content — Snack supports
   multi-file projects and folders).
4. Add the dependencies listed in `package.json` via Snack's "Add dependency" search.
5. Preview live on the Snack web player, or scan the QR with the **Expo Go** app on your phone.

> Snack note: `app.json` intentionally has no `owner` field and no `extra.eas.projectId` —
> both break Snack's import/bundling. If you need EAS builds later (outside Snack), add
> `extra.eas.projectId` back with value `34764801-f60a-4128-b8a0-393da61c1d35`, and set
> `owner` to your Expo account username.

### Option B: On-device via Userland + Expo Go
1. Inside Userland (Ubuntu), install Node.js (v18+) and npm.
2. `npm install -g expo-cli` (or just use `npx expo`).
3. Copy this whole `zannypay` folder into your Userland filesystem.
4. `cd zannypay && npm install`
5. `npx expo start --tunnel` (tunnel mode avoids local network/firewall issues from Userland).
6. Install **Expo Go** from the Play Store on the same phone, scan the QR code shown in the
   terminal.

### Option C: Full local dev later (more resources)
Same as Option B minus `--tunnel` — use `--lan` or plain `npx expo start` on the same Wi-Fi.

## Project structure

```
zannypay/
├── App.js                          # entry point, ErrorBoundary + offline sync kickoff
├── app.json                        # Expo config (no owner/eas fields — see Snack note above)
├── assets/                         # app icon, splash, adaptive icon, favicon
├── package.json
├── src/
│   ├── context/WalletContext.js    # auth + wallet state, talks to apiClient
│   ├── services/
│   │   ├── apiClient.js            # HTTP calls to the backend, USSD fallback, offline queue
│   │   ├── SyncEngine.js           # persists + replays requests made while offline
│   │   └── SecureStorage.js        # encrypted on-device storage (biometric PIN unlock)
│   ├── navigation/AppNavigator.js
│   ├── screens/
│   │   ├── SplashScreen.js, OnboardingScreen.js
│   │   ├── SignupScreen.js, LoginScreen.js      # PIN pad + biometric unlock
│   │   ├── DashboardScreen.js                   # home/wallet, pull-to-refresh
│   │   ├── TransferScreen.js, BillsScreen.js, InvoiceScreen.js
│   │   ├── CardScreen.js, AnalyticsScreen.js, RewardsScreen.js
│   │   ├── HistoryScreen.js, TransactionDetailScreen.js
│   │   ├── ProfileScreen.js, SupportScreen.js, DeveloperConsoleScreen.js
│   ├── components/                 # Card, GradientButton, TransactionRow, FundModal, ErrorBoundary
│   ├── theme/colors.js              # single source of truth for brand colors
│   └── utils/                       # formatting + storage helpers
```

## What to change first when you're ready to go further

1. Deploy the real backend at the URL in `EXPO_PUBLIC_API_URL` (or point it at yours) with
   `/auth/signup`, `/auth/login`, `/user/me`, `/transactions/transfer`, `/transactions/bills`,
   and `/transactions/fund` endpoints.
2. Replace the client-side PIN check assumption with server-side hashed-PIN or OTP verification
   — the client should never be the source of truth for whether a PIN is correct.
3. Connect `CardScreen.js` to a real virtual card issuance API.
4. Add a real KYC step to `SignupScreen.js` before activating a wallet.

## Branding note

This is intentionally **not** branded as "PalmPay" (name/logo) to avoid trademark issues —
it's called "Zannypay" as a placeholder. Swap in your own name, logo, and color palette in
`src/theme/colors.js`, `app.json`, and `assets/`.
