# Postman Master Collection

One Postman collection with **every REST endpoint** of the Farmer App API: 255 requests in 23 folders. Use it to try the API, to check what a request needs, and to test the platform without opening the admin panel.

## Files

| File | What it is |
|---|---|
| `farmer-app.master.postman_collection.json` | The master collection. All 255 requests. |
| `farmer-app.master.postman_environment.json` | The **Farmer App - Local** environment: the base address, the token and every id the requests use. |
| `build-collections.ts` | The script that builds both files from the route files. See "When the API changes" below. |

Live updates over Socket.IO are not REST requests, so they are not in the collection. They are explained in `backend/SOCKETS.md`.

## Before you start

1. The backend is running (see `MASTER-README.md`, section 6). Check it: open `http://localhost:5000/api/v1/health` in a browser.
2. You have a user to sign in with. After the first start with `DB_SEED=true` the super admin from `backend/.env` exists (`SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD`).
3. Postman is installed (the desktop app, or the web app at postman.com).

## Set it up (one time)

1. In Postman click **Import**.
2. Drop both files into the window: `farmer-app.master.postman_collection.json` and `farmer-app.master.postman_environment.json`. Click **Import**.
3. At the top right, open the environment list and choose **Farmer App - Local**.
4. Click the eye icon next to the list, then **Edit** next to the environment, and check these values:

| Variable | Set it to |
|---|---|
| `baseUrl` | The API address including `/api/v1`. Local: `http://localhost:5000/api/v1`. Live: your real API address, for example `https://api.yourdomain.com/api/v1`. |
| `adminEmail` | The super admin email from `backend/.env` |
| `adminPassword` | The super admin password from `backend/.env` |

5. Click **Save**.

## Your first request

1. Open the folder **Auth** and the request **Login**.
2. Click **Send**. You should see `"success": true`.
3. That is all. The token from the answer is saved by itself, and every other request already uses it.

If the token expires, send **Login** again, or send **Refresh** (it uses the saved refresh token).

## How the collection works

**Sign in is automatic.** The collection uses Bearer authentication with `{{token}}`. Requests that need no sign in (health, config, login, the public survey link) are set to No Auth.

**Ids are saved for you.** After every response the collection reads the answer. If it finds an object with an `id`, it saves it in the environment under a name made from the object. A created farm is saved as `farmId`, a program as `programId`, a user as `userId`, and so on. Later requests that need that id already use it, written as `{{farmId}}`.

**Example bodies.** Each request that sends data has an example body with the **required** fields only. They are built from the same rules the server checks, so a valid example passes. The request description lists the optional fields too, and the **Who can call it** line tells you which roles are allowed.

**Optional filters are switched off.** On list requests the optional query parameters (page, search, status and so on) are listed but unchecked. Tick the ones you want.

**File uploads** use **Body, form-data**. The file field is already added. Click **Select Files** and choose the file. The field name is given in the request description. Examples: `avatar` for a profile picture, `files` for assessment evidence photos, `file` for documents and Excel imports.

## A good order to try things

1. **Auth, Login** (as the super admin).
2. **Users**: create a farmer and an assessor. Their ids are saved as `userId`.
3. **Farms** and **Fields**: create a farm and a field.
4. **Programs**: create a program and enroll the farmer.
5. **Assessments**: create a template, add categories and questions (or import an Excel file), and let the program use it.
6. **Auth, Login** again as the farmer (change the email and password in the body) and use the **Assessments** and **Assessor Assessments** folders to answer and review.

## Trying a different role

Many requests are limited to some roles, for example only `super_admin` and `admin`. To test as another user, open **Auth, Login**, change the email and password in the body to that user, and send. The new token replaces the old one. Sign in as the super admin again to go back.

A request answered with `403` means the signed in role is not allowed to call it. A `401` means the token is missing or expired.

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

## When the API changes

The collection is built from the route files, so it can always be built again. From the `backend` folder run:

```bash
npx tsx postman/build-collections.ts
```

This rewrites the Postman files in this folder and the Hoppscotch master files in `backend/hoppscotch/`. Import them again. Run it whenever a route is added, removed or renamed.

## If something goes wrong

| What you see | What to do |
|---|---|
| `Could not get any response` | The backend is not running or `baseUrl` is wrong |
| `401` | Send **Auth, Login** again |
| `403` | The signed in role may not call this request. Sign in as the right role. |
| `400` with a list of errors | A field is missing or wrong. The message says which. Compare with the example body. |
| `404` on a request with an id | The id variable is empty or old. Create the item first, or paste a real id into the environment. |
| `429` | Too many requests in a short time. Wait a few minutes. |
