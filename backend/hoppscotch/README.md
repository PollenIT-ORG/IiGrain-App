# Hoppscotch Master Collection

One Hoppscotch collection with **every REST endpoint** of the Farmer App API: 255 requests in 23 folders. Hoppscotch is a free tool that works in the browser or as a desktop app. Use this collection to try the API and to check what each request needs.

## Files

| File | What it is |
|---|---|
| `master-collection.json` | The master collection. All 255 requests. |
| `master-environment.json` | The **Farmer App (local)** environment: the base address, the token and every id the requests use. |
| `../postman/build-collections.ts` | The script that builds these files from the route files. |

The folders in this directory hold short notes written for single features. They are not collections. Every request is in the master collection. Live updates over Socket.IO are not REST requests, so they are not in the collection. They are explained in `backend/SOCKETS.md`.

## Before you start

1. The backend is running (see `MASTER-README.md`, section 6). Check it: open `http://localhost:5000/api/v1/health` in a browser.
2. You have a user to sign in with. After the first start with `DB_SEED=true` the super admin from `backend/.env` exists (`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`).
3. You have Hoppscotch: the web app at hoppscotch.io or the desktop app. If you test a backend on your own computer from the web app, the browser may block the calls. In that case use the desktop app, or the Hoppscotch browser extension, or run it with the **Agent** interceptor (Settings, Interceptor).

## Set it up (one time)

**1. Import the environment**

1. Click **Environments** in the left column.
2. Click **Import / Export**, then **Import**, then **Hoppscotch** (or **Import from JSON**).
3. Choose `master-environment.json`.
4. Open the environment drop down at the top right and select **Farmer App (local)**.

**2. Import the collection**

1. Click **Collections** in the left column.
2. Click **Import / Export**, then **Import**, then **Hoppscotch**.
3. Choose `master-collection.json`.
4. The collection **Farmer App - Master Collection** appears with its folders.

**3. Check three variables.** Open **Environments**, click **Farmer App (local)** and set:

| Variable | Set it to |
|---|---|
| `baseUrl` | The API address including `/api/v1`. Local: `http://localhost:5000/api/v1`. Live: your real API address, for example `https://api.yourdomain.com/api/v1`. |
| `adminEmail` | The super admin email from `backend/.env` |
| `adminPassword` | The super admin password from `backend/.env` |

Save the environment.

## Your first request

1. Open the folder **Auth** and the request **Login**.
2. Click **Send**. You should see `"success": true`.
3. That is all. The token from the answer is saved in the environment by a small script, and every other request already uses it.

If the token expires, send **Login** again, or send **Refresh token**.

## How the collection works

**Sign in is automatic.** Requests that need a sign in use Bearer authentication with `<<token>>`. Requests that need none (health, config, login, the public survey link) have authentication switched off.

**Ids are saved for you.** After every response a script reads the answer. If it finds an object with an `id`, it saves it in the environment under a name made from the object. A created farm is saved as `farmId`, a program as `programId`, a user as `userId`, and so on. Later requests that need that id already use it, written as `<<farmId>>`. The environment must be selected for this to work.

**Example bodies.** Each request that sends data has an example body with the **required** fields only. They are built from the same rules the server checks, so a valid example passes. Optional fields are not in the example. Add them yourself when you need them. The server answers with a clear message when a field is missing or wrong.

**Optional filters are switched off.** On list requests the optional query parameters (page, search, status and so on) are listed under **Parameters** but not active. Switch on the ones you want.

**File uploads** use the **Body** tab with content type **multipart/form-data**. The file field is already added. Click it and choose the file. Typical field names: `avatar` for a profile picture, `files` for assessment evidence photos, `file` for documents and Excel imports.

## A good order to try things

1. **Auth, Login** (as the super admin).
2. **Users**: create a farmer and an assessor.
3. **Farms** and **Fields**: create a farm and a field.
4. **Programs**: create a program and enroll the farmer.
5. **Assessments**: create a template, add categories and questions (or import an Excel file), and let the program use it.
6. **Auth, Login** again as the farmer (change the email and password in the body) and use the **Assessments** and **Assessor Assessments** folders to answer and review.

## Trying a different role

Many requests are limited to some roles. To test as another user, open **Auth, Login**, change the email and password in the body to that user, and send. The new token replaces the old one. Sign in as the super admin again to go back.

`403` means the signed in role may not call the request. `401` means the token is missing or expired.

## Folders

| Folder | What is in it |
|---|---|
| Health | Is the server up, is the database reachable |
| Config | Public settings: branding, contact details, time format |
| Auth | Register, login, one time codes, refresh, logout, forgot and reset password |
| Roles | The roles a person can sign up as |
| Login Logs | Who signed in and when |
| Users | Create, list, change, deactivate and restore users |
| Profile | The signed in person's own profile, avatar and password |
| Organizations | The organization's details, logo and favicon |
| Email Settings | SMTP and Resend settings and a test email |
| Farms | Farms, for office staff and for the farmer's own list |
| Fields | Fields, boundaries, documents and soil |
| Assessments | Templates, categories, questions, import and export, review and scores |
| Assessor Assignments | Which assessor looks after which farmer |
| Assessor Assessments | What an assessor sees and fills in |
| Programs | Programs, enrollments, progress and submissions |
| Dashboard | Numbers and charts |
| Visits | Assessor field visits and live location |
| Field Monitoring | Practice records for a field, by module |
| Notifications | The notification list and read marks |
| FAQs | Help questions and answers |
| Contact Enquiries | Messages from the contact form and replies |
| Program Survey (Admin) | Survey templates, programs, contracts and submissions for the office |
| Program Survey (Public Link) | The survey a producer opens from a program link |

Folders with many requests (Assessments, Program Survey (Admin) and others) are split into sub folders.

## When the API changes

The collection is built from the route files. From the `backend` folder run:

```bash
npx tsx postman/build-collections.ts
```

This rewrites the Hoppscotch master files and the Postman master files. Import them again. Run it whenever a route is added, removed or renamed.

## If something goes wrong

| What you see | What to do |
|---|---|
| Network error or no response | The backend is not running, `baseUrl` is wrong, or the browser blocked the call (use the desktop app or the Agent interceptor) |
| `401` | Send **Auth, Login** again |
| `403` | The signed in role may not call this request |
| `400` with a list of errors | A field is missing or wrong. The message says which. Compare with the example body. |
| `404` on a request with an id | The id variable is empty or old. Create the item first, or paste a real id into the environment. |
| `429` | Too many requests in a short time. Wait a few minutes. |
