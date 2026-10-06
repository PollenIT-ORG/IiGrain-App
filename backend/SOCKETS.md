# Live Updates (Socket.IO)

This guide explains how the platform pushes changes to screens the moment they happen: a new notification, an assessor moving on the map, a submission that was just reviewed, a list that changed in the admin panel.

## The short answer

**You do not need to set up anything for this.**

- Live updates run inside the backend. They start by themselves when the backend starts.
- They use the **same address and the same port** as the API. There is no second server.
- There is **no outside service, no account, no API key and no extra setting** for live updates. Pusher, Firebase, Redis and similar services are not used.
- The technology is called Socket.IO. It is a library already installed with the backend.

If the backend runs, live updates run.

---

## How it works

A normal request is a question and an answer: the screen asks, the server replies. Live updates add a second path: after a screen has connected once, the server can send a short message to it at any time.

```text
 Admin panel          Mobile app          Survey status page
      \                   |                    /
       +------ one connection each (token) ---+
                          |
              Backend  (same address as the API)
                          |
      changes data  ->  tells the people who care
```

1. A screen connects to the backend and proves who it is with its **token** (the same token it uses for API requests).
2. The server puts that connection into **rooms**. A room is a private group, for example "everything for this user".
3. When data changes, the backend sends one short message to the right room. The message only says what changed.
4. The screen reacts by loading the fresh data with a normal API request.

Messages are hints, not data. A screen should always reload from the API when it gets one. This keeps the live path simple and safe.

If a screen is offline it misses the messages. When it connects again it should reload what it shows. Nothing is stored or replayed.

---

## Who connects

| Who | Proves who they are with | Room they are put in | Messages they get |
|---|---|---|---|
| Mobile app user (farmer or assessor) | Access token | `user:<userId>` | `sync`, `notification:new`, `notification:unread_count`, `visit:location`, `visit:status` |
| Admin panel (super admin or admin) | Access token | `user:<userId>` and `admins` | `data:changed`, `notification:*`, `visit:*` |
| Program admin in the panel | Access token | `user:<userId>` and `admins` | `data:changed`, `notification:*`. Each reload only returns what that role may read. |
| A producer on the survey status page | The status link token (no account) | `submission:<submissionId>` | `application:changed` |
| Everyone connected | | | `config:changed` |

Connection address: the API host without `/api/v1`, with path `/socket.io`. Example: if the API is `https://api.yourdomain.com/api/v1`, connect to `https://api.yourdomain.com` with path `/socket.io`.

A connection with no token, or with an expired token, is refused with a `connect_error`.

---

## Messages the server sends

### `sync` (mobile app)

Sent to every device of a user when that user's data changed, on another device or because an admin or assessor changed it.

```json
{
  "resource": "assessment",
  "action": "answer_saved",
  "programId": "...",
  "fieldId": "...",
  "categoryId": "..."
}
```

| Part | Values |
|---|---|
| `resource` | `assessment`, `field`, `farm`, `soil`, `enrollment`, `document` |
| `action` | `answer_saved`, `submitted`, `reviewed`, `discarded`, `created`, `updated`, `deleted`, `reset`, `enrolled`, `unenrolled` |
| Ids | `programId`, `fieldId`, `farmId`, `categoryId`, `questionId`, `enrollmentId`, when they apply |

Rule: treat it as "something changed" and reload the matching screen.

### `data:changed` (admin panel)

Sent to everyone in the `admins` room (super admin, admin and program admin) when data in the panel is out of date.

```json
{ "resource": "submissions" }
```

`resource` is one of: `enrollments`, `submissions`, `visits`, `assignments`, `dashboard`, `farms`, `fields`, `users`, `programs`, `organizations`, `eligibility`, `survey_questions`, `program_admin_survey`, `faqs`, `contact_enquiries`, `assessments`, `login_logs`, `email_settings`. The message carries no data, only the name of what changed.

Where it comes from:

- A middleware (`middlewares/liveChanges.ts`) announces it after any successful write (POST, PUT, PATCH, DELETE) on the routes that feed the panel, whoever made the write: the panel, the mobile app or a public link. A refused write (4xx or 5xx) announces nothing.
- Services also announce changes that are not a request, such as a visit that expired.
- Changes that come close together are sent as one message per resource (after 250 ms of quiet, and never later than 1 second after the first).

### How the admin panel stays current

Every screen of the panel reads its data through one cache. The component `LiveSync` (mounted once, in the layout) does three jobs:

1. **A message arrives.** It marks the matching data out of date (`lib/liveSync.ts` lists which data each resource touches), and only what is open on screen is loaded again. This works for every page, with nothing to add per page.
2. **The connection returns after a break.** Everything on screen is loaded again, so nothing announced while it was down stays missing.
3. **The connection is down.** Everything on screen is loaded again every 30 seconds until it is back.

On top of that, opening a page, returning to the browser tab and the network coming back each load fresh data, and a page refresh always starts from the server. A forgotten message therefore never leaves a wrong screen for long.

A refused connection (for example a token that expired while the tab was open) is not retried by Socket.IO itself. The panel fetches a new token with the refresh token and tries again, waiting longer each time up to 30 seconds. A returning tab or network triggers an immediate try. A form that is open is not overwritten when its record changes in the background: it is filled once, when it finishes loading.

### `notification:new` and `notification:unread_count`

```json
{ "id": "...", "type": "...", "title": "...", "body": "...", "data": {}, "redirect": { "screen": "..." }, "read": false, "created_at": "..." }
```

`notification:new` carries a new notification. `notification:unread_count` carries `{ "count": 3 }` and is sent after every change of the unread number. The REST endpoints under `/notifications` do the same jobs, so a client may also use these two messages only as a signal to reload.

### `visit:location`, `visit:status`, `visit:error`

Used for the live map. See the next section.

### `application:changed` (survey status page)

Sent to a producer's status page when their application moves.

```json
{ "event": "contract_sent", "submissionId": "..." }
```

`event` is one of `submission_scored`, `band_changed`, `contract_sent`, `contract_signed`, `enrolled`, `withdrawn`.

### `config:changed`

Sent to everyone connected, with no content, when branding or contact details change in Settings. Clients reload `GET /config`.

---

## Messages a client can send

All of them take an optional reply function (an "ack") that returns `{ "ok": true, ... }` or `{ "ok": false, "error": "..." }`.

| Message | Content | What it does |
|---|---|---|
| `visit:join` | `{ "visitId" }` | Starts watching a visit. The reply holds the current visit. Only people allowed to see the visit can join. |
| `visit:location` | `{ "visitId", "lat", "lng", "accuracy_m", "is_mock" }` | The assessor sends a position. Everyone watching gets `visit:location`. |
| `visit:arrived` | `{ "visitId" }` | The assessor says they reached the field. Watchers get `visit:status`. |
| `visit:end` | `{ "visitId", "outcome": "completed" or "cancelled" }` | Ends the visit. Watchers get `visit:status`. |
| `notification:unread_count` | none | Reply: `{ "ok": true, "count" }` |
| `notification:read` | `{ "notificationId" }` | Marks one as read. Reply holds the new count. |
| `notification:read_all` | none | Marks all as read. |

Starting a visit is a REST call (`POST /visits`). Everything after that, the moving position and the watching, goes over the connection.

---

## Connecting from code

Install the client library in the app that connects: `npm install socket.io-client`. The admin panel already has it.

```js
import { io } from "socket.io-client";

const socket = io("https://api.yourdomain.com", {
  path: "/socket.io",
  auth: { token: accessToken },        // the same token used as Bearer
  transports: ["websocket", "polling"],
});

socket.on("connect", () => reloadWhatIsOnScreen());
socket.on("connect_error", (e) => { /* token missing or expired */ });

socket.on("sync", (p) => reload(p.resource, p));
socket.on("notification:new", () => reloadNotifications());
```

Connect once after sign in, close with `socket.disconnect()` when the person signs out, and connect again with the new token after the next sign in. Do not open more than one connection per app. A client reconnects by itself after a network break. Rooms that were joined with `visit:join` have to be joined again after a reconnect.

The survey status page connects with the link token instead of an access token:

```js
const socket = io("https://api.yourdomain.com", { path: "/socket.io", auth: { statusToken } });
socket.on("application:changed", () => reloadStatus());
```

The admin panel does this in `admin/src/lib/socket.ts` and `admin/src/lib/surveySocket.ts`.

---

## Trying it without writing an app

**With a short script.** This uses the library that is already installed in `admin/`. Run it from the `admin` folder with a token from **Auth, Login** (see the Postman or Hoppscotch guide):

```bash
cd admin
node --input-type=module -e "import { io } from 'socket.io-client'; const s = io('http://localhost:5000', { path: '/socket.io', auth: { token: process.argv[1] } }); s.on('connect', () => console.log('connected')); s.on('connect_error', (e) => console.log('refused:', e.message)); s.onAny((name, data) => console.log(name, JSON.stringify(data)));" "PASTE_TOKEN_HERE"
```

Leave it running, then change something (save an answer, send a notification, start a visit) from the admin panel, Postman or Hoppscotch. The messages appear in the terminal.

**With Postman or Hoppscotch.** Both have a Socket.IO client next to the normal request screen (in Hoppscotch it is under Realtime). Use the address without `/api/v1`, set the path to `/socket.io`, and give the access token in the Bearer authorization field of the connection (the server accepts the token there as well as in the `token` auth value). Then add listeners for the message names above. These clients are optional; the script above is enough.

---

## Running it live

| Topic | What to know |
|---|---|
| Address and port | Same as the API. Nothing to open besides what the API already uses. |
| CORS | `CORS_ORIGIN` in `backend/.env` is used for live connections too. Put the admin panel address there. |
| Reverse proxy | If Nginx or another proxy sits in front of the backend, it must pass WebSocket connections on the path `/socket.io` (the `Upgrade` and `Connection` headers). Most hosting platforms do this by default. |
| Fallback | The admin panel connects with WebSocket first and falls back to plain polling, so a strict network slows it down instead of switching it off. |
| One backend only | Rooms are kept in the memory of the backend process. Run one backend instance. If you ever run several, they need a shared adapter (for example Redis) so a message reaches connections held by another instance. Single instance setups, which is the current one, need nothing. |
| Restarts | A restart drops every connection. Clients reconnect by themselves and reload what they show. |

---

## If something goes wrong

| What you see | What to check |
|---|---|
| `connect_error`: authentication or invalid token | The token is missing or expired. Sign in again and reconnect with the new token. |
| Connects, but no messages arrive | The connection is not in the room you expect. Check the table "Who connects". A mobile user does not receive `data:changed`, and the admin panel does not use `sync`. |
| Works locally, not live | The proxy does not pass WebSocket, or `CORS_ORIGIN` does not list the panel address |
| A screen is stale after being offline | Expected. Reload the screen on `connect`. |
| Visit join fails | The signed in person is not part of that visit |
