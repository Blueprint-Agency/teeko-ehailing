# Teeko — Rider Trip Disputes

> Feature spec + implementation plan. Lets a rider raise a dispute (fare
> overcharge, wrong payment, driver conduct, safety, lost item, other) from a
> past ride's receipt. Disputes persist in the backend and surface in the
> Admin **Disputes Queue** (`apps/admin/app/(panel)/disputes`).

## 1. Goal & scope

**In scope (this feature):**

- Rider can open a dispute from the **ride history detail / receipt** screen
  (`apps/rider/app/(main)/receipt/[id].tsx`) for a **completed** or
  **cancelled** trip.
- Pick a **category**, optionally state a **disputed amount** (for money
  categories), and write a **description**.
- One open dispute per trip. If a dispute already exists, the receipt shows its
  **status** instead of the "Report an issue" button.
- Disputes are stored server-side and are readable by admins for resolution.

**Out of scope (follow-up):**

- Admin write-back to the rider (resolution push notifications). The admin panel
  already has a resolution UI over its own mock data; wiring that panel to this
  backend table is a separate task noted in §8.
- In-app chat/threaded messaging on a dispute (the safety/chat module covers
  live-trip comms).

## 2. UX flow

```
Rides tab ─▶ Receipt [id]
                │
                ├─ (completed/cancelled) "Report an issue" ─▶ DisputeSheet
                │                                                │
                │        category select ─ amount? ─ description ┘
                │                                                │
                │                                         submit ▼
                └─ dispute exists ─▶ status row (Open / Under review /
                                     Resolved / Rejected) + description
```

- Entry point renders **only** for finished trips (`completed` / `cancelled`).
- `DisputeSheet` mirrors `CancelTripSheet.tsx`: a `BottomSheet` with selectable
  reason rows, an amount field (shown for `overcharge` / `payment`, prefilled
  from the trip fare), a multiline description `Input`, and a submit `Button`.
- On success the sheet dismisses and the receipt swaps the button for a status
  row.

## 3. Data model

### Categories (`DisputeCategory`)

| value        | rider-facing meaning                    | amount field |
|--------------|-----------------------------------------|--------------|
| `overcharge` | Fare higher than expected / wrong route | yes (prefill) |
| `payment`    | Charged twice / wrong method / refund   | yes           |
| `service`    | Driver conduct / vehicle / service      | no            |
| `safety`     | Felt unsafe / dangerous driving         | no            |
| `lost_item`  | Left an item in the vehicle             | no            |
| `other`      | Anything else                           | no            |

> `overcharge` / `payment` / `safety` line up with the Admin queue's existing
> category vocabulary (`apps/admin/stores/dispute.ts`); `service` maps to the
> admin `misconduct` bucket.

### Status (`DisputeStatus`)

`open` → `under_review` → `resolved` | `rejected`

### Shared type (`packages/shared/src/types/rider.ts`)

```ts
export type DisputeCategory =
  | 'overcharge' | 'payment' | 'service' | 'safety' | 'lost_item' | 'other';
export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected';

export interface RiderDispute {
  id: string;
  tripId: string;
  category: DisputeCategory;
  status: DisputeStatus;
  amountMyr?: number;      // present for money categories
  description: string;
  resolution?: string;     // filled by admin when resolved/rejected
  createdAt: string;
  resolvedAt?: string;
}
```

### Backend table (`apps/backend/src/db/schema/trips.ts`)

```
dispute_category  pgEnum(overcharge, payment, service, safety, lost_item, other)
dispute_status    pgEnum(open, under_review, resolved, rejected)

disputes
  id           uuid pk
  trip_id      uuid → trips(id)  (cascade)
  rider_id     uuid → users(id)
  category     dispute_category
  status       dispute_status  default 'open'
  amount_cents integer          (nullable — sen-integer money, per ledger convention)
  description  text
  resolution   text             (nullable)
  resolved_at  timestamptz      (nullable)
  created_at   timestamptz      default now()
```

Money is stored as **integer sen** (`amount_cents`), matching the payment
ledger convention; the client sends/receives `amountMyr` and the boundary
converts.

## 4. API

Registered under the existing rider scope (`requireRole('rider')`) in
`apps/backend/src/api/rider/index.ts` with prefix `/disputes`.

| Method | Path                              | Body / Query                          | Returns          |
|--------|-----------------------------------|---------------------------------------|------------------|
| POST   | `/api/v1/rider/disputes`          | `{ tripId, category, amountMyr?, description }` | `RiderDispute` (201) |
| GET    | `/api/v1/rider/disputes?tripId=`  | —                                     | `RiderDispute[]` |

**Rules (service layer):**

- Trip must exist and belong to the caller → else `404 TRIP_NOT_FOUND` /
  `403 FORBIDDEN`.
- Trip must be `completed` or `cancelled` → else `422 TRIP_NOT_DISPUTABLE`.
- Reject if the trip already has a non-terminal dispute (`open` /
  `under_review`) → `409 DISPUTE_EXISTS`.
- `amountMyr` accepted only for `overcharge` / `payment`; ignored otherwise.

## 5. Frontend wiring

- `packages/api/src/client/disputes.ts` — `create()`, `listForTrip()` via the
  shared `api()` helper; exported as `disputesApi`.
- `packages/api/src/stores/dispute-store.ts` — `useDisputeStore` with
  `byTrip`, `loadForTrip(tripId)`, `submit(input)`; mirrors the payments store.
- `apps/rider/components/DisputeSheet.tsx` — new sheet (copy of
  `CancelTripSheet`).
- `receipt/[id].tsx` — loads the trip's disputes, renders the entry
  point / status row and the sheet.

## 6. i18n

New `dispute.*` block added to all four locales (`en`, `ms`, `ta`, `zh`) under
`packages/i18n/src/locales/`: title, subtitle, the six category labels, amount
+ description field labels/placeholders, submit, the four status labels, the
existing-dispute heading, and success/error toasts.

## 7. Files touched

**Backend**
- `apps/backend/src/db/schema/trips.ts` (+`disputes` table & enums)
- `apps/backend/src/modules/disputes/service.ts` (new)
- `apps/backend/src/api/rider/disputes.routes.ts` (new)
- `apps/backend/src/api/rider/index.ts` (register)
- `apps/backend/drizzle/*` (generated migration)

**Shared / API**
- `packages/shared/src/types/rider.ts`
- `packages/api/src/client/disputes.ts` (new) + `client/index.ts`
- `packages/api/src/stores/dispute-store.ts` (new) + `src/index.ts`

**Rider app**
- `apps/rider/components/DisputeSheet.tsx` (new)
- `apps/rider/app/(main)/receipt/[id].tsx`

**i18n**
- `packages/i18n/src/locales/{en,ms,ta,zh}.json`

## 8. Follow-ups (not in this change)

1. Point the Admin **Disputes Queue** at `GET /api/v1/admin/disputes` (backed by
   this table) instead of `data/mock-disputes.json`, and add an admin
   resolve/reject/escalate endpoint that writes `status` + `resolution`.
2. Push notification to the rider when a dispute is resolved.
3. Attachment uploads (photos/screenshots) for evidence.

## 9. Migration

After pulling this change, run from `apps/backend`:

```
pnpm db:generate   # emits the disputes migration SQL
pnpm db:migrate    # applies it (needs DATABASE_URL)
```
