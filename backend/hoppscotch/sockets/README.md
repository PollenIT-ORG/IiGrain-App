# Sockets - complete guide for the mobile app

This is the full real-time guide. The app uses ONE Socket.IO connection for
everything: live data sync across devices, notifications, and assessor visits.
Set up the connection once, then add the listeners you need.

There are three channels:
1. `sync` - live data updates (an assessment answer, a field, an enrollment, etc.)
2. `notification:*` - the notification bell (new items + unread count)
3. `visit:*` - the live assessor-visit map

---

## 1. Connect (do this once, after login)

```js
import { io } from "socket.io-client";

const socket = io(BASE_URL, {          // BASE_URL is the API host, no /api/v1
  path: "/socket.io",
  auth: { token: accessToken },        // the SAME JWT you send as Bearer
  transports: ["websocket"],
  reconnection: true,                  // default true - keep it on
});

socket.on("connect", () => { /* connected */ });
socket.on("connect_error", (e) => { /* bad/expired token */ });
```

- The token is required. If it is missing/expired the connection is refused with
  `connect_error`.
- On connect, the server automatically puts every device of the user into a
  private room `user:<userId>`. You do not join anything yourself.
- When the user logs out, disconnect: `socket.disconnect()`. On login, reconnect
  with the new token (`socket.auth = { token }; socket.connect()`), or create a
  fresh socket.

---

## 2. Live data sync - the `sync` event

Whenever the user's data changes - on another of their devices, OR because an
admin/assessor changed something that belongs to them - the server sends:

```js
socket.on("sync", (p) => { /* refetch the affected screen */ });
```

Payload:

```ts
{
  resource: "assessment" | "field" | "farm" | "soil" | "enrollment" | "document",
  action:   "answer_saved" | "submitted" | "discarded" |
            "created" | "updated" | "deleted" | "reset" |
            "enrolled" | "unenrolled",
  programId?, fieldId?, farmId?, categoryId?, questionId?, enrollmentId?,
}
```

**Rule of thumb:** treat it as "something changed" and refetch the relevant
screen. Do not hand-patch state from the payload - just refetch.

### When it fires

Farmer's own actions (any device) and admin/assessor actions on the farmer's data
both reach the farmer:

| Something changed | resource / action |
|---|---|
| An answer saved / changed | `assessment` / `answer_saved` |
| Assessment submitted | `assessment` / `submitted` |
| Assessment discarded | `assessment` / `discarded` |
| A field created / edited / deleted / reset | `field` / `created`,`updated`,`deleted`,`reset` |
| A farm created / edited / deleted / reset | `farm` / `created`,`updated`,`deleted`,`reset` |
| Soil saved | `soil` / `updated` |
| Enrolled / fields added to a program | `enrollment` / `enrolled` |
| Fields in an enrollment changed | `enrollment` / `updated` |
| Unenrolled | `enrollment` / `unenrolled` |
| Assessor assigned / changed / removed | `enrollment` / `updated` |

Assessor devices get `assessment` / `answer_saved` and `submitted` for their own
work, plus `enrollment` / `updated` when they are assigned or unassigned. When an
assessor submits, the farmer also gets `assessment` / `submitted`.

### Suggested handler

```js
socket.on("sync", (p) => {
  switch (p.resource) {
    case "assessment":
      if (onScreen(p.programId, p.fieldId)) refetchAssessment(p.programId, p.fieldId);
      invalidate(["summary", p.fieldId], ["history", p.fieldId], ["regen", p.fieldId]);
      break;
    case "field":
    case "farm":
      invalidate(["farms"], ["fields", p.farmId]);
      break;
    case "soil":
      if (onSoilScreen(p.fieldId)) refetchSoil(p.fieldId);
      break;
    case "enrollment":
      invalidate(["my-programs"], ["my-fields"], ["available-programs"]);
      break;
  }
});
```

With RTK Query / React Query, invalidate the matching cache tags/keys here and
let the library refetch.

---

## 3. Notifications

Two server events keep the bell live:

```js
// A brand new notification arrived
socket.on("notification:new", (n) => {
  // n = { id, type, title, body, data, redirect, read, created_at }
  refetchNotificationList();   // or prepend n to your list
  bumpBellBadge();
});

// The unread count changed (after read/read-all/delete)
socket.on("notification:unread_count", ({ count }) => {
  setBellBadge(count);
});
```

You can also drive everything from REST and just use the two events above as
"refetch now" triggers.

### Notification REST endpoints

| Method + path | Purpose |
|---|---|
| `GET /notifications?page=&limit=` | list (paged). Response `data`: `{ notifications, unreadCount }`, plus `meta` for paging. `unreadCount` is the TRUE total unread, not limited to the page. |
| `GET /notifications/unread-count` | `{ count }` |
| `PATCH /notifications/:id/read` | mark one read (idempotent; 404 if not yours) |
| `PATCH /notifications/read-all` | mark all read |
| `DELETE /notifications/:id` | delete one (404 if not yours) |
| `POST /notifications/delete` body `{ "ids": ["...", "..."] }` | delete selected |
| `DELETE /notifications` | delete all |

Recommended bell UI: show the latest ~15 in the dropdown, and the badge shows the
full `unreadCount`. A "view all" screen can page through everything and offer
mark-all-read, delete selected, and delete all.

### `redirect` - where to go when a notification is tapped

Each notification has a `redirect` object telling you the target screen:

```ts
redirect: { screen: string, fieldId?, programId?, enrollmentId?, visitId? }
```

Use `redirect.screen` (and the ids) to navigate. `visitId` -> the live visit
screen; `fieldId`/`programId` -> the relevant field/program.

---

## 4. Assessor visits (live map)

A visit is a real-time session between an assessor (moving) and a farmer
(watching). It uses request/response socket messages with an ack callback.

### Assessor side

```js
// start is a REST call: POST /visits { fieldId } -> returns the visit
// then stream location over the socket:
socket.emit("visit:location", { visitId, lat, lng }, (ack) => {
  // ack = { ok: true, visit } or { ok: false, error }
});

socket.emit("visit:arrived", { visitId }, (ack) => { /* ... */ });
socket.emit("visit:end", { visitId, outcome: "completed" | "cancelled" }, (ack) => { /* ... */ });
```

### Farmer side (watching)

```js
// join the visit room to receive live updates
socket.emit("visit:join", { visitId }, (ack) => {
  // ack.visit = the current visit snapshot
});

socket.on("visit:location", (visit) => updateMarker(visit)); // assessor moved
socket.on("visit:status",   (visit) => updateStatus(visit)); // en_route -> arrived -> completed
socket.on("visit:error",    ({ message }) => showError(message));
```

The farmer can find an active visit for themselves with `GET /visits/mine/farmer`,
and the assessor with `GET /visits/mine/assessor`. When a visit starts, the
farmer also receives a `notification:new` (assessor on the way).

---

## 5. Reconnect and offline

Socket.IO auto-reconnects. Events are fire-and-forget (not queued), so a device
that was offline can miss `sync` events. Handle this with a one-time refetch on
(re)connect:

```js
socket.on("connect", () => {
  refetchCurrentScreen();      // catch up on anything missed
  refetchNotificationList();
});
```

---

## 6. Full minimal example

```js
import { io } from "socket.io-client";

let socket;

export function connectSocket(token) {
  socket = io(BASE_URL, { path: "/socket.io", auth: { token }, transports: ["websocket"] });

  socket.on("connect", () => {
    refetchCurrentScreen();
    refetchNotificationList();
  });

  socket.on("sync", (p) => handleSync(p));
  socket.on("notification:new", () => refetchNotificationList());
  socket.on("notification:unread_count", ({ count }) => setBadge(count));

  socket.on("connect_error", (e) => {
    // token likely expired - refresh it and reconnect, or send to login
  });

  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
}
```

---

## Notes

- None of this changes any REST response. Sockets are an additive real-time layer.
  The app works without them; add the listeners to get the live behaviour.
- One connection handles all three channels. Do not open multiple sockets.
- The admin panel uses a separate event (`data:changed`) for its own lists - the
  mobile app does not need it. `sync` is the mobile channel.

## Who listens to what

Three audiences share one socket server. Each has its own rooms and events, so
listening to the wrong one just means you never receive anything.

| Audience | Token | Room | Event to listen for |
|----------|-------|------|---------------------|
| Mobile app user | app JWT | `user:<userId>` | `sync`, `notification:new`, `visit:*` |
| Admin panel | app JWT (admin role) | `admins` | `data:changed` |
| Website account | website JWT (`kind: "website"`) | `website:<websiteUserId>` | `application:changed` |

The website channel is new. It carries the eligibility and enrollment flow, so
the producer's browser updates the moment an admin acts:

```json
{ "event": "contract_sent", "submissionId": "...", "token": "..." }
```

`event` is one of `submission_scored`, `band_changed`, `contract_sent`,
`contract_signed`, `enrolled`. **The mobile app does not need this** - it is the
browser side of the flow, before the producer ever installs the app.

There is also a `config:changed` event with no payload, sent to everyone when an
admin changes the branding or contact details. The mobile app can ignore it
unless it starts reading branding from `/config`.
