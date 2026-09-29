# 11 — Photos, Documents and Files

---

## 1. Where media is used today

| Screen / component | Purpose | Picker | Transport |
|---|---|---|---|
| `screens/assessment/shared/QuestionView.tsx` + `components/assessment/EvidenceUploader.tsx` | Assessment evidence (photo / video / pdf) | `imagePickerService`, `documentPickerService` | `POST /assessments/evidence` multipart, one file per request, `timeout 5 min`, `skipRetry: true` |
| `screens/monitoring/MonitoringRecordFormScreen.tsx`, `MonitoringRecordScreen.tsx`, `MonitoringModuleScreen.tsx` + `components/monitoring/AttachmentPickerSheet.tsx` | Monitoring documents | same | `POST /field-monitoring/fields/{id}/documents` multipart |
| `screens/farms/FieldDetailsScreen.tsx` | Field documents | same | `POST /fields/{id}/documents` multipart |
| `screens/profile/ProfileScreen.tsx` | Avatar | `imagePickerService` | `POST /profile/me/avatar` multipart |

Pickers: `react-native-image-crop-picker` 0.51.1 (camera + gallery, crop,
compression to `compressMaxEdge: 1600`, quality 0.75, `maxSizeMB: 10`) and
`@react-native-documents/picker` 12.0.2.

Every upload builds `FormData` with a `{ uri, name, type }` part, and
`services/http.ts` swaps the content type and sets `transformRequest = data => data`.

---

## 2. Why the current design cannot be queued as-is

1. **`FormData` is not serialisable.** A queue row cannot hold a `FormData`; it can
   only hold a path. So the queue must store paths and rebuild the multipart body at
   flush time. (This is a second, independent reason for the "reference, not
   snapshot" queue rule in `09` §3.)

2. **Picker URIs are temporary.** `react-native-image-crop-picker` writes to a
   cache directory:
   * Android: app cache (`/data/data/<pkg>/cache/...`) — eligible for OS eviction
     under storage pressure, and cleared by "Clear cache".
   * iOS: `NSTemporaryDirectory()` / `tmp` — **the OS may delete this at any time**,
     and it is explicitly not backed up.

   A queued upload that survives a week in the queue will very plausibly find its
   file gone. **Every offline-captured file must be copied into app-private durable
   storage at pick time**, before the queue row is written.

3. **Assessment evidence must upload before the answer can be saved.** Covered in
   `07` §5 — the answer body only accepts server URLs.

---

## 3. SQLite vs filesystem

**Recommendation: metadata in SQLite, binaries on the filesystem.** No BLOBs.

```
SQLite  media_files   → local_id, purpose, attached_to, file_path, file_name,
                        mime, size_bytes, upload_status, retry_count, remote_url
Filesystem            → the actual bytes
```

Reasons specific to this app: files are up to 10 MB and include video; the app
already ships `react-native-fs` and already has a working
app-scoped download implementation (`services/fileDownloadService.ts`); a media
BLOB table would bloat the DB file, slow every backup/restore, and make the
`VACUUM` story ugly. Nothing in the app needs transactional consistency between a
row and its bytes beyond "the row records the path".

### Directory layout

Extend the pattern already in `fileDownloadService.ts`
(`DocumentDirectoryPath` on iOS, `ExternalDirectoryPath` on Android, subfolder
`iiGrain/`):

```
<BASE>/iiGrain/
    downloads/                       ← existing, cached remote documents
    outbox/<owner_user_id>/          ← NEW: offline-captured files awaiting upload
        <media_local_id>.<ext>
```

* Both bases are **app-scoped**: uninstall removes them, no storage permission is
  needed on Android (this is why the existing downloader picked them), and
  `ExternalDirectoryPath` is not indexed by the gallery.
* Scoping the outbox by `owner_user_id` keeps user B from ever seeing user A's
  pending photos (`13`).

### iOS backup flag

`DocumentDirectoryPath` on iOS **is** backed up to iCloud. For the outbox that is
arguably desirable (a device restore keeps pending work) but it does inflate
backups with 10 MB videos, and Apple's guidelines discourage backing up
regenerable data. `REQUIRES PRODUCT DECISION`: set the "exclude from backup"
attribute on `outbox/`, or leave it backed up. Recommendation: exclude
`downloads/` (regenerable), keep `outbox/` backed up (not regenerable).

---

## 4. Proposed capture and upload flow

```
CAPTURE (offline or online)
   pick file (crop-picker / document-picker)
      → copy from the temp URI into outbox/<user>/<media_local_id>.<ext>   (RNFS.copyFile)
      → INSERT media_files (upload_status='local', attached_to_*)
      → INSERT sync_queue (entity_type='media', operation='UPLOAD')
      → UI immediately renders the thumbnail from file_path

FLUSH (online)
   for each pending media, in queue order:
      POST the appropriate multipart endpoint
      → on success: media_files.remote_url = url, upload_status='uploaded'
      → then re-issue the parent write so the URL is attached:
            assessment evidence → re-PUT the answer with the rebuilt evidenceUrls
            field/monitoring doc → the upload endpoint IS the attach, nothing further
      → optionally delete the local copy, or keep it as the cache entry
```

### Ordering rule

A media UPLOAD must flush **before** the parent write that references its URL, but
**after** the parent entity exists (a field document needs a server `fieldId`). In
`sync_queue` terms:

```
field CREATE  →  media UPLOAD  →  parent re-write (answers only)
```

### Retry rule

`uploadEvidenceFile` sets `skipRetry: true` and a 5-minute timeout. Keep that — a
half-sent 10 MB video should not be auto-retried by the axios interceptor. The
**sync engine** owns retries for uploads, with its own backoff, so exactly one
retry policy is in force.

### Storage hygiene

* Cap the outbox (e.g. 500 MB or 100 files per user); warn before capture when near
  the cap. Nothing worse than a farmer filling their phone with unsent photos.
* Purge `uploaded` media older than N days.
* Purge the whole outbox for a user on logout **only if** the queue is empty —
  otherwise warn (`13`).
* On startup, reconcile: any `media_files` row whose `file_path` no longer exists
  → `upload_status = 'failed'`, `last_error = 'file missing'`, and tell the user
  which answer/record lost its attachment. Silent loss is the worst outcome.

---

## 5. Can files survive an app restart?

| | Today | With this design |
|---|---|---|
| Picked-but-unsent file | **No** — temp URI, path held only in component state | **Yes** — copied to `outbox/`, path in SQLite |
| Downloaded document | **Yes** — already app-scoped via `fileDownloadService` | Yes, unchanged |
| Upload progress | No — in-memory only | Restarts from zero (no resumable upload endpoint exists) |

Note there is **no resumable/chunked upload** anywhere in the API. A 10 MB video
interrupted at 90% restarts from 0%. On a weak rural connection that can loop
forever. Mitigations, in order of cheapness:

1. Lower `compressMaxEdge` / quality for offline-captured evidence (already
   configurable in `imagePickerService`).
2. Only attempt large uploads on an unmetered/strong connection — NetInfo exposes
   connection type and `isConnectionExpensive`.
3. `REQUIRES BACKEND CHANGE` if this proves to be a real field problem: a chunked or
   resumable upload endpoint.

---

## 6. Verdicts

| Capability | Verdict |
|---|---|
| Capture a photo/video/document offline | **FULLY OFFLINE** (camera and picker are local) |
| Store it durably until upload | **FULLY OFFLINE** (with the outbox copy) |
| Show it in the UI before upload | **FULLY OFFLINE** |
| Attach it to an assessment answer offline | **PARTIALLY OFFLINE** — captured and linked locally, but the answer only carries the URL after upload (`07` §5) |
| Upload it | **ONLINE REQUIRED**, queued |
| Open an already-downloaded document offline | **FULLY OFFLINE — works today** |
| Open a not-yet-downloaded document offline | **ONLINE REQUIRED** |
| Resume an interrupted upload | **NOT CURRENTLY FEASIBLE** — no resumable endpoint |
