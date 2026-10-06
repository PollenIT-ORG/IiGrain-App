# Third Party Services Guide

This guide is for the owner of the platform. It explains, in simple words, which outside services the Farmer App uses, what each one is for, how you get your own keys, and where you put them.

You do not need to be a developer to follow Part 1 and Part 2. Part 3 and Part 4 are for the person who looks after the server.

---

## Part 1. The short answer

The platform uses **4 outside services**. Only the first three need an account.

| # | Service | What it is used for | Account needed? | Cost |
|---|---------|---------------------|-----------------|------|
| 1 | **PostgreSQL** | The database. All data is saved here. | Yes (or run your own) | Free if you run it yourself |
| 2 | **Cloudinary** | Stores photos, documents, signatures, contract PDFs, logo and profile pictures. | Yes | Free plan available |
| 3 | **Email (SMTP or Resend)** | Sends sign in codes, welcome emails, survey emails and contracts. | Yes | Free plans available |
| 4 | **OpenStreetMap** | Shows maps, place search and route lines. | **No** | Free |

Nothing else is used. There is no payment service, no SMS service and no Google Maps key.

**Yes, you can get all the keys yourself.** You create the accounts in your own name, copy the keys, and paste them into the settings file. You do not need us for this. Part 2 shows every step.

---

## Part 2. How to get each key

### Where the keys go

The backend reads its settings from a file called `.env` in the `backend` folder.

1. Open the `backend` folder.
2. Make a copy of `.env.example` and name the copy `.env`.
3. Open `.env` in any text editor and fill in the values.
4. Restart the backend so it reads the new values.

Rules:

- Never share the `.env` file. It holds your secrets.
- Never upload the `.env` file to GitHub or send it in a chat.
- If you use Docker or a hosting dashboard, add the same names and values as **environment variables** there. You do not need the file.

---

### 1. PostgreSQL (the database)

**Which database do we use in live?**
PostgreSQL. In live it runs on our own server. It is not a cloud database service. The backend connects to it with one value called `DATABASE_URL`.

**What does the value look like?**

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
```

| Part | Meaning | Example |
|------|---------|---------|
| USER | Database user name | `postgres` |
| PASSWORD | Database password | `your_password` |
| HOST | Where the database runs | `localhost` or your server address |
| PORT | Database port | `5432` |
| DATABASE | Name of the database | `farmer_app` |

**How do you get a database?** Pick one:

1. **On your own computer or server.** Install PostgreSQL (version 13 or newer) from postgresql.org. Create an empty database called `farmer_app`.
2. **With Docker (easiest for testing).** Run this one command:
   ```
   docker run --name farmer-db -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=farmer_app -p 5432:5432 -d postgres:16
   ```
   Your value is then `postgresql://postgres:postgres@localhost:5432/farmer_app`.
3. **A hosted PostgreSQL service.** For example Neon, Supabase or AWS RDS. Create a database there and copy the connection string they show you. If the service needs SSL, add `DB_SSL=true`.

**Do I need to create tables?** No. The backend creates all tables by itself. You only switch it on once. See Part 3, step 4.

**Important:** the database user must be allowed to use the `pgcrypto` extension. The `postgres` user can. If you see "permission denied to create extension", use the `postgres` user for the first start.

---

### 2. Cloudinary (photos and files)

**Why?** Every photo, document, signature, contract PDF, profile picture, logo and favicon is saved in Cloudinary. The database only keeps the link.

**Steps:**

1. Go to cloudinary.com and create a free account.
2. Log in and open the **Dashboard**.
3. You will see your **Cloud name** there.
4. Open **Settings**, then **API Keys**. Copy the **API Key** and the **API Secret**. (If there is no key yet, click Generate New API Key.)
5. Put the three values in `.env`:

```
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

All three are required. The backend will not start without them.

**Good to know:**

- The backend makes these folders in your Cloudinary by itself: `farmer_evidence`, `farmer_documents`, `farmer_avatars`, `farmer_branding`, `farmer_signatures`, `farmer_contracts`. You do not need to create them.
- Every email shows a logo at the top. That logo is a fixed link inside `backend/src/services/emailTemplates.ts` (the line named `EMAIL_LOGO_URL`). If you move to your own Cloudinary account, upload your logo there and replace that link with the new one.
- Cloudinary menu names change now and then. If a name above looks different, look for "API Keys".

---

### 3. Email (SMTP or Resend)

**Why?** People get a code by email when they register, sign in or reset a password. Producers also get survey, contract and welcome emails. In live, email must be working.

You can choose **one** of two ways. Both are supported.

#### Option A. SMTP (any email provider)

SMTP works with most providers: Gmail, Outlook or Microsoft 365, Zoho, your web hosting company, Amazon SES, SendGrid and others. You need five values from the provider.

| Value in `.env` | What it is |
|-----------------|------------|
| `SMTP_HOST` | The server name, for example `smtp.gmail.com` |
| `SMTP_PORT` | Usually `587`. Use `465` if the provider says SSL. |
| `SMTP_SECURE` | `false` for port 587. `true` for port 465. |
| `SMTP_USER` | The login, usually the full email address |
| `SMTP_PASS` | The password (see the note below) |

Also set:

```
SMTP_ENABLED=true
SMTP_FROM_NAME=Farmer App
SMTP_FROM_EMAIL=no-reply@yourdomain.com
```

`SMTP_FROM_NAME` is the sender name people see. `SMTP_FROM_EMAIL` is the sender address. It should be an address your provider allows you to send from.

**Example with Gmail:**

1. Sign in to the Google account you want to send from.
2. Turn on **2-Step Verification** (Google Account, then Security).
3. In the same Security area, open **App passwords** and create one. Google shows a 16 letter password.
4. Use these values:
   ```
   SMTP_ENABLED=true
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_SECURE=false
   SMTP_USER=youraddress@gmail.com
   SMTP_PASS=the16letterapppassword
   ```

Note: for Gmail you must use the App password. Your normal Gmail password will not work.

#### Option B. Resend (works over the internet, no SMTP port needed)

1. Go to resend.com and create an account.
2. Open **API Keys** and create a key. It starts with `re_`.
3. Open **Domains**, add your domain and add the DNS records they show. Wait until it says Verified.
4. Put the key in the admin panel (not in `.env`): **Settings, then Email, choose "Resend API"**, paste the key and save.

#### Setting email from the admin panel

You can also type the SMTP values in the admin panel: **Settings, then Email**. The panel has:

- Sender name and sender email
- Send through: **SMTP server** or **Resend API**
- If it fails: send the message through the other one
- A **Send a test** box. Type your email address and press send to check that it works.

Values saved in the panel are used first. If nothing is saved in the panel, the backend uses the values from `.env`.

**While you are only testing:** keep `SMTP_ENABLED=false`. The sign in codes then show in the backend terminal and no email is sent.

---

### 4. Maps (OpenStreetMap), no key needed

The admin panel shows maps for farms, fields and live visits. It uses free public services:

| Service | Used for |
|---------|----------|
| OpenStreetMap tiles | The map picture |
| Nominatim | Searching for a place by name |
| OSRM | Drawing a route line |

You do not create an account and you do not add a key. These are shared public servers, so they ask users not to send very heavy traffic. If the platform grows a lot, ask your developer to move to a paid map provider.

The admin panel also loads the Inter font from Google Fonts. That needs no account either.

---

## Part 3. Values you can write yourself

Some values are not keys from a company. You choose them.

| Value | What to write |
|-------|---------------|
| `JWT_SECRET` | A long random text. It protects every login. Make one with this command: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `SUPER_ADMIN_EMAIL` | The email of the first super admin |
| `SUPER_ADMIN_PASSWORD` | A strong password for that account |
| `SUPER_ADMIN_NAME` | The name of that account |
| `CORS_ORIGIN` | The address of your admin panel, for example `https://admin.yourdomain.com`. Use `*` only on your own computer. |
| `APP_URL` | The address of your admin panel. Links inside emails are built from it. |
| `MOBILE_APP_URL` | The link where people get the mobile app (a Play Store, App Store or TestFlight link). It goes in the welcome email and in the "Open the app" button of the emails sent to farmers and assessors. Left empty, those buttons are left out. |
| `PORT` | The port the backend uses. Default is `5000`. |

### Start the backend for the first time

On the very first start of a new database you need two switches. They create the tables and the first accounts.

1. In `.env` set `DB_SYNC=true` and `DB_SEED=true`.
2. Start the backend.
3. Wait for the message that migrations finished and the super admin was created.
4. Set both back to `false` and restart.

What they do:

- `DB_SYNC=true` creates or updates all tables. It is safe to run again.
- `DB_SEED=true` creates the roles, the organization (only when none exists yet), the first super admin and the starter help questions. Without the organization, programs and farms cannot be created.

When we ship an update that changes the database, switch `DB_SYNC=true` on again for one deploy.

### Sign in to the admin panel

Use the `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_PASSWORD` you wrote in `.env`.

---

## Part 4. Checklist before going live

- [ ] `DATABASE_URL` points to your live database
- [ ] The three Cloudinary values are filled in
- [ ] Email works. Use **Send a test** in Settings, then Email.
- [ ] `JWT_SECRET` is a long random text, not the example text
- [ ] `SUPER_ADMIN_PASSWORD` is strong
- [ ] `NODE_ENV=production`
- [ ] `CORS_ORIGIN` is your admin address, not `*`
- [ ] `APP_URL` is your admin address
- [ ] `DB_SYNC` and `DB_SEED` are back to `false` after the first start
- [ ] `RATE_LIMIT_ENABLED=true`
- [ ] A database backup is scheduled. Example: `pg_dump "YOUR_DATABASE_URL" -Fc -f backup.dump`

---

## Part 5. If something goes wrong

| What you see | What it means | What to do |
|--------------|---------------|------------|
| `Missing required environment variable` | A required value is empty | Fill it in `.env` and restart. The message names the value. |
| The backend cannot connect to the database | Wrong `DATABASE_URL`, or the database is off | Check user, password, host, port and name. Check that PostgreSQL is running. |
| Connection works only with SSL | The host needs SSL | Add `DB_SSL=true` |
| `permission denied to create extension` | The database user is too limited | Use the `postgres` user for the first start |
| Photos do not upload | Cloudinary values are wrong | Check cloud name, key and secret. Copy them again without spaces. |
| No emails arrive | Email is off or wrong | Set `SMTP_ENABLED=true` or use Settings, Email, then Send a test. Check the spam folder. |
| Gmail says the login is refused | Normal password used | Create and use an App password |
| The admin panel shows a network error | The panel cannot reach the backend, or CORS blocks it | Check `VITE_API_BASE_URL` in the admin build and `CORS_ORIGIN` in the backend |
| Maps are blank | The internet blocks OpenStreetMap | Check the network or firewall |

For the full setup guide, including Docker, see [MASTER-README.md](MASTER-README.md).
