# 17 — Domain adapters and dependency chains

## What an adapter is

A `DomainSyncAdapter` is the only place that knows how one domain talks to the server.
The sync engine owns ordering, claiming, retry and failure classification; the adapter
owns the URL, the body and the response shape.

```ts
interface DomainSyncAdapter {
  entityType: string;
  create?(context): Promise<SyncAdapterResult>;
  update?(context): Promise<SyncAdapterResult>;
  delete?(context): Promise<SyncAdapterResult>;
  verifyCreated?(context): Promise<SyncAdapterResult | null>;
}
```

Adapters are registered in `DEFAULT_ADAPTERS` (`syncBootstrap.ts`).

## Reference, not snapshot

A queue entry stores *which* row to send, never a frozen copy of it. Every adapter reads
the current row at flush time. Three consequences:

- Editing the same record five times offline sends one request carrying the final state.
- A parent id that did not exist when the entry was queued is resolved when it is sent.
- A row deleted locally before flush makes its own entry fail cleanly instead of
  resurrecting stale data.

## Resolving parents

Child adapters never trust the id they were queued with. They look the parent up:

| Adapter | Resolves | Fails with |
|---|---|---|
| `fieldAdapter` | farm `server_id` from `farm_local_id` | "The farm this field belongs to has not been synced yet." |
| `monitoringAdapter` | field `server_id` from `field_local_id` | "The field this record belongs to has not been synced yet." |
| `fieldBoundaryAdapter` | farm + field `server_id` | same shape |
| `fieldSoilAdapter` | field `server_id` | same shape |
| `mediaAdapter` | field and/or monitoring record `server_id` from `context_json` | same shape |

These are retryable failures, not permanent ones — the entry waits and tries again.

## Dependency ordering

The write helpers in `domainWrites.ts` set `depends_on_id` when they queue a child whose
parent is itself unsynced:

```
createFarmOffline       → queue #1  farm create
createFieldOffline      → queue #2  field create        depends_on_id = 1
createMonitoringOffline → queue #3  record create       depends_on_id = 2
commitMedia             → queue #4  media upload        depends_on_id = 3
```

`getNextEligible` will not hand out an entry whose dependency is still pending, so the
chain drains strictly in order. If entry #1 fails, #2–#4 are simply not attempted — they
are not failed, and nothing is discarded.

If a dependency fails *permanently*, `failEntriesBlockedByFailedDependency` marks the
blocked children failed rather than leaving them stuck forever. They stay in the queue and
stay visible.

Proven end-to-end in `__tests__/offlineChain.test.ts`, including an assertion that no
local id ever appears in an outgoing URL.

## Duplicate protection

The backend accepts no client-supplied id and no `Idempotency-Key`, so a create whose
response is lost would otherwise be re-POSTed and duplicated.

`verifyCreated` runs before any retry of a `create` (never on the first attempt). It asks
the server whether the record already exists:

| Adapter | Match rule |
|---|---|
| `farmAdapter` | name + area, created within 24 h |
| `fieldAdapter` | name + area within the parent farm, created within 24 h |
| `monitoringAdapter` | every non-empty local value matches, created within 24 h |

On a match the local row adopts that `server_id` and the entry completes with no second
POST. Boundaries and soil need none of this — both are `PUT` and replace in place.

This narrows but does not close the window; see the backend recommendations in
`OFFLINE_STATUS.md`.

## Media

Media is the one domain where the payload is not a row. See `OFFLINE_STATUS.md` for the
draft → commit → upload lifecycle. The adapter's own rules:

- refuses to upload when the durable file is gone, and marks the row `failed` with a
  message the user can act on;
- returns early if the row is already `uploaded`, so a replayed entry cannot double-post;
- routes by `purpose` (monitoring document, field document, assessment evidence).

## Adding another domain

1. Give the entity a row type and a repository if it does not have one.
2. Add its key to `ENTITY_TYPES`.
3. Write the adapter; resolve parents by local id, never by a captured id.
4. Add a write helper in `domainWrites.ts` that stores and queues in **one** transaction,
   setting `dependsOnId` when the parent is unsynced.
5. Register the adapter in `DEFAULT_ADAPTERS`.
6. Add `verifyCreated` if the create endpoint is not idempotent.
