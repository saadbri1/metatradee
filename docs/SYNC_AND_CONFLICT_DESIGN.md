# Offline Sync & Conflict Design (Phase 11.3)

The single hardest correctness problem in the product: a trade synced twice is a
duplicate that corrupts every downstream number. This document is the contract;
`src/features/mobile-sync/` implements exactly it and is unit-tested against it.

The engine is **framework-agnostic pure TypeScript** — no React Native, no device
APIs, no web changes. A native app injects a `SyncStorage` adapter
(Keychain/SQLite) and an `ApiClient` (the 11.2 SDK); the engine owns the rules.

## 1. The idempotency guarantee (absolute)

Every offline mutation carries a **client-generated idempotency key** minted once
at enqueue time and **never regenerated on retry**. It is:

- Sent as the API `Idempotency-Key` (11.2 contract) — a retried POST returns the
  first result instead of double-creating, server-side.
- Combined with the **Journal's existing content hash** (`tradeContentHash`) —
  the _same_ dedupe definition the 10.8 import engine uses. No second rule.

Re-sending, retrying, resuming after app-kill, or a duplicated delivery can
**never** create a duplicate. Proven by test (replay the whole queue → zero new
server writes).

## 2. The durable queue

- **Ordered** (FIFO by `seq`) and **durable** — persisted via the injected
  `SyncStorage`, surviving app kill/restart; the pure engine keeps no hidden
  in-memory truth.
- Each item: `{ id, idempotencyKey, seq, kind, payload, contentHash, status,
attempts, lastError, baseVersion }`. `status ∈ pending | in_flight | synced |
failed | conflict`.
- **Resumable**: on restart, `in_flight` items are re-driven — safe via
  idempotency. `synced` items are pruned; `failed`/`conflict` await the user.
- **Retry with backoff** `[2s, 8s, 30s, 2m, 10m]` then → `failed` (surfaced,
  never silently dropped). Deterministic + tested.

## 3. Conflict resolution (explicit, never silent)

Device time is **untrusted**; the server is authoritative for day/session
bucketing and derived fields.

| Kind       | Policy                                                       | Rationale                                             |
| ---------- | ------------------------------------------------------------ | ----------------------------------------------------- |
| **create** | idempotent insert (hash)                                     | duplicate → `synced`, never re-inserted or conflicted |
| **edit**   | **version guard** (`baseVersion`); server-newer → `conflict` | never silently overwrite a concurrent server edit     |
| **delete** | tombstone; already-gone → `synced` no-op                     | deleting a gone row is success                        |

A `conflict` is **shown with both values**; `resolveConflict` returns
`keep_local | keep_server | merge` — the user decides, the engine never picks or
discards. `mergeFields` applies a field-level choice.

## 4. Server-authoritative derived fields

Offline trades store only **inputs**; PnL/R/RR/duration are computed **on the
server at sync** via the same `computeDerivedTradeFields` the web uses. Device
never computes money. Test: offline trade's server-computed derived == web trade
with the same inputs (reconciliation).

## 5. Visible sync state

`summary()` → `{ pending, inFlight, failed, conflicts, lastSyncedAt }` — the UI
shows counts, last-synced time, and a path to resolve failures. No hidden state.

## 6. Isolation & privacy

Queue + cache are **scoped per (userId, workspaceId)**; workspace switch or logout
**purges** them (`purge()`) — no cross-account bleed. Payloads are opaque to the
engine and never logged; the native layer encrypts sensitive payloads at rest.

## 7. Not shipped this phase (documented seams)

The RN/Expo app, native secure storage (Keychain/Keystore), biometric gate, push
transport, image-upload pipeline, EAS/store config, and the live `ApiClient`
wiring are a **native/manual phase** — they need a device, EAS, store credentials,
and the live 11.2 API. This phase ships and proves the correctness engine they
depend on.
