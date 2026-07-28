# Enrollment ID on first-time registration

**Status: nothing has changed in the API yet. Do not start this work.**

This note exists so you know what is coming and can plan for it. The current
`POST /auth/register` behaves exactly as it does today. When the client signs
off on the new flow, this file will be updated with the final contract and only
then should the app change.

## Why this is coming

Producers no longer sign up straight from the app. The new order is:

1. A producer scans a QR code or opens a link and lands on the iiGrain website.
2. They create a website account and answer an eligibility survey.
3. If they qualify, an admin sends them a contract to sign.
4. Once they sign and the admin accepts, they are issued an **Enrollment ID**
   in the format `IIG-2026-482913` (`IIG-<year>-<6 digits>`).
5. The welcome email tells them to download the app and register **using that
   Enrollment ID**.

So by the time someone opens the app for the first time, the platform already
knows who they are. The Enrollment ID is what ties the app account back to the
signed contract.

## What will change in the app

Only the **first-time registration** screen. Login is untouched, and everything
after registration is untouched.

- One extra required field on the register form: **Enrollment ID**.
- Suggested input treatment: uppercase, trim spaces, and let the user paste the
  whole `IIG-2026-482913` string. Do not try to auto-format or split it into
  boxes - people will paste it straight out of the email.
- Client-side check before submitting: not empty. Leave the real validation to
  the server so the rules can change without an app release.

Everything else on that screen stays as it is.

## Request shape (planned)

`POST /auth/register` gains one field:

```json
{
  "fullName": "Jane Miller",
  "email": "jane@example.com",
  "phone": "+12025550188",
  "password": "...",
  "enrollmentId": "IIG-2026-482913"
}
```

## Errors to handle (planned)

All of these come back in the standard error envelope you already handle, with
`errors[]` carrying the field name so you can show the message inline under the
Enrollment ID input.

| Case | HTTP | Message you will get |
|------|------|----------------------|
| Missing | 400 | Your Enrollment ID is required. |
| Wrong format or unknown | 400 | We could not find that Enrollment ID. Please check the email we sent you. |
| Already used to register | 409 | An account has already been created with this Enrollment ID. Please log in instead. |

Show the message from the server. Do not hardcode these strings in the app - the
wording is still being agreed with the client.

## What you can do now

Nothing in the app. If you want to be ready, the only safe preparation is to
make sure your register screen can render one more text input and one more
inline field error without a layout rewrite.

## Related

- `live-sync/README.md` - the `sync` socket event, already live.
- `sockets/README.md` - socket setup and all events.
- `mobile-api-changes/README.md` - the API changes that are already shipped.
