# Live multi-device sync (Socket.IO)

Goal: when the same account is logged in on more than one device, a change made
on one device shows up on the others live, without a manual refresh. Example:
two phones open on the same assessment; one phone completes a category; the other
phone updates on its own.

This is done with a single Socket.IO event called `sync`. The app already uses
Socket.IO for notifications and visits, so this is the same connection - you only
need to add one listener.

## How the connection works (unchanged)

- Connect to the server with the user's access token, exactly like you already do
  for notifications/visits:

```js
import { io } from "socket.io-client";

const socket = io(BASE_URL, {
  path: "/socket.io",
  auth: { token: accessToken }, // same JWT you send as Bearer
  transports: ["websocket"],
});
```

- On the server, every socket for a user automatically joins a private room
  `user:<userId>`. So **all devices of the same account are in the same room**.
  You do not send or join anything - it is automatic on connect.

**Important - it is not only your own devices.** A `sync` event is sent to a user
whenever THEIR data changes, no matter who changed it. So the farmer's app updates
live when:
- the farmer changes something on another of their own devices, AND
- an admin or assessor changes something that belongs to the farmer (enrolls them,
  edits/creates/deletes one of their farms or fields, saves their soil, assigns an
  assessor, or the assessor submits an assessment on the farmer's field).

The same is true for an assessor: they are synced when they are assigned/unassigned
or when an enrollment they are on changes. So every screen stays live end to end.

## The event: `sync`

Whenever that user's data changes on any device, the server emits ONE event to
the room:

```
socket.on("sync", (payload) => { ... })
```

Payload shape:

```ts
{
  resource: "assessment" | "field" | "farm" | "soil" | "enrollment" | "document",
  action:   "answer_saved" | "submitted" | "discarded" |
            "created" | "updated" | "deleted" | "reset" |
            "enrolled" | "unenrolled",
  // context ids - present only when relevant to that resource:
  programId?: string,
  fieldId?: string,
  farmId?: string,
  categoryId?: string,
  questionId?: string,
  enrollmentId?: string,
}
```

**What to do with it:** if the payload refers to something the current screen is
showing, refetch that screen's data. Keep it simple - refetch, do not try to
patch state by hand from the payload. The payload is a "something changed" signal
plus enough ids to know whether it is relevant.

Note: the device that made the change ALSO receives the echo (it is in the same
room). That is fine - it already updated optimistically, and a refetch is
harmless. If you want to skip your own echo, compare against your own last
action; it is optional.

## When the server emits `sync`

Farmer actions (emitted to the farmer's devices):

| Action | payload.resource / action | Refetch on the other device |
|---|---|---|
| Saves / changes an answer | `assessment` / `answer_saved` | the question, the category progress, the field summary |
| Submits an assessment | `assessment` / `submitted` | the field review / summary / history |
| Discards an assessment | `assessment` / `discarded` | the field review / summary |
| Creates a field | `field` / `created` | the farm's field list |
| Edits a field | `field` / `updated` | that field + the list |
| Deletes a field | `field` / `deleted` | the farm's field list |
| Resets a field | `field` / `reset` | that field |
| Creates a farm | `farm` / `created` | the farm list |
| Edits a farm | `farm` / `updated` | that farm + list |
| Deletes a farm | `farm` / `deleted` | the farm list |
| Resets a farm | `farm` / `reset` | that farm |
| Saves soil | `soil` / `updated` | the field's soil tab |
| Enrolls / adds fields to a program | `enrollment` / `enrolled` | my-programs, my-fields |
| Unenrolls a field | `enrollment` / `unenrolled` | my-programs, my-fields |

Assessor actions (emitted to the assessor's devices):

| Action | payload.resource / action |
|---|---|
| Saves / changes an answer | `assessment` / `answer_saved` |
| Submits an assessment | `assessment` / `submitted` (also sent to the farmer) |

Admin actions - these reach the affected farmer (and assessor where relevant):

| Admin does | Synced to | payload.resource / action |
|---|---|---|
| Creates / edits / deletes / resets a farmer's farm | farmer | `farm` / `created`,`updated`,`deleted`,`reset` |
| Creates / edits / deletes / resets a farmer's field | farmer | `field` / `created`,`updated`,`deleted`,`reset` |
| Saves soil on a farmer's field | farmer | `soil` / `updated` |
| Enrolls a farmer / changes enrolled fields | farmer (+ assessor) | `enrollment` / `enrolled`,`updated` |
| Unenrolls a farmer | farmer (+ assessor) | `enrollment` / `unenrolled` |
| Assigns / changes / removes the assessor | farmer + assessor(s) | `enrollment` / `updated` |

## Suggested implementation

One listener, registered once after connect, that maps the payload to a refetch:

```js
socket.on("sync", (p) => {
  switch (p.resource) {
    case "assessment":
      // if the open screen is this program+field, refetch it
      if (isViewing(p.programId, p.fieldId)) refetchAssessment(p.programId, p.fieldId);
      // also refresh the field summary / history caches
      invalidate(["summary", p.fieldId], ["history", p.fieldId]);
      break;
    case "field":
    case "farm":
      invalidate(["fields", p.farmId], ["farms"]);
      break;
    case "soil":
      if (isViewing(null, p.fieldId)) refetchSoil(p.fieldId);
      break;
    case "enrollment":
      invalidate(["my-programs"], ["my-fields"]);
      break;
  }
});
```

If you use RTK Query or React Query, the cleanest approach is to invalidate the
relevant cache tags/keys in this handler and let the library refetch.

## Reconnect / offline

Socket.IO auto-reconnects. Because `sync` is fire-and-forget (not a stored queue),
if a device was offline it may miss events. So on reconnect, do a one-time refetch
of the current screen to catch up. A simple `socket.on("connect", refetchCurrentScreen)`
covers it.

## Notes

- This does not change any REST response. It is an additive real-time signal.
- Nothing here is required for the app to function - without the listener the app
  works exactly as today, just not live across devices. Add the listener to get
  the live behaviour.
- The admin panel uses a different event (`data:changed`) for its own lists; you
  do not need it. `sync` is the mobile channel.
