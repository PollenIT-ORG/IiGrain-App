# Profile Picture (avatar) - API guide (React Native dev)

Lets any logged-in user (farmer, assessor, admin) set a profile picture, from the
photo gallery OR the camera. The image is stored on Cloudinary; the user record
keeps its URL in `avatar_url`.

Base URL in examples: `http://localhost:5000/api/v1`. All routes need
`Authorization: Bearer <token>`.

Import `profile-picture.json` (Collections -> Import -> Hoppscotch) and
`environment.json` to try it. Log in first (main collection's Auth -> Login) so
`token` is set.

---

## Endpoints

| Method | URL | What it does |
|--------|-----|--------------|
| `GET` | `/profile/me` | Returns the user; now includes `avatar_url` (string or null) |
| `POST` | `/profile/me/avatar` | Upload/replace the picture (multipart, field `avatar`) |
| `DELETE` | `/profile/me/avatar` | Remove the picture (sets `avatar_url` to null) |

Same endpoint works for admin, farmer and assessor - it always acts on the
logged-in user. No new field is added to any request body; only `GET /profile/me`
(and every place that returns a user) now carries `avatar_url`.

---

## Upload contract

- Method: `POST /profile/me/avatar`
- Body: `multipart/form-data`, ONE file under the field name **`avatar`**
- Allowed types: `jpg`, `jpeg`, `png`, `webp`, `heic`
- Max size: **5 MB**
- The server auto-crops to a 512x512 square (face-centered), so any aspect ratio is fine.

Success (200):

```json
{
  "success": true,
  "message": "Profile picture updated.",
  "data": {
    "user": {
      "id": "...",
      "full_name": "Ravi Kumar",
      "email": "ravi@example.com",
      "avatar_url": "https://res.cloudinary.com/.../farmer_avatars/xyz.jpg",
      "role": "farmer"
    }
  }
}
```

Errors: non-image or no file -> `400`; file over 5 MB -> `400`.

---

## React Native usage

Use any image picker that can do **gallery AND camera** (e.g.
`react-native-image-picker`: `launchImageLibrary` for gallery,
`launchCamera` for camera). Then send the picked file as multipart under
`avatar`:

```ts
async function uploadAvatar(asset: { uri: string; fileName?: string; type?: string }) {
  const form = new FormData();
  form.append("avatar", {
    uri: asset.uri,
    name: asset.fileName ?? "avatar.jpg",
    type: asset.type ?? "image/jpeg",
  } as any);

  const res = await fetch("http://YOUR_HOST:5000/api/v1/profile/me/avatar", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      // do NOT set Content-Type manually; let fetch set the multipart boundary
    },
    body: form,
  });
  const json = await res.json();
  return json.data.user.avatar_url; // new picture URL
}
```

Gallery vs camera is purely a client choice of which picker you launch; the
upload call is identical. To remove the picture, call
`DELETE /profile/me/avatar`.

Show the avatar from `user.avatar_url`; if it is `null`, fall back to initials.

---

## cURL (quick test)

```bash
# Upload from a local file
curl -X POST -H "Authorization: Bearer $TOKEN" \
  -F "avatar=@/path/to/photo.jpg" \
  http://localhost:5000/api/v1/profile/me/avatar

# Remove
curl -X DELETE -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/v1/profile/me/avatar
```
