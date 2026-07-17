# AppImagePicker

A reusable, library-agnostic, strongly-typed image-picker module for the iiGrain
app. Drop it into Profile photo, Farm images, Field images, Assessment evidence,
documents - any module - without modification.

```
AppImagePicker (controlled UI)
   ├── ImagePickerBottomSheet   Camera / Gallery / Remove / Cancel
   ├── ImagePreview             thumbnails · delete · loading · count
   └── services/imagePickerService   ← the ONLY file that touches the native lib
          ├── permissions/mediaPermissions   granted / denied / blocked / limited
          ├── utils/imageHelpers             pure helpers (size, ext, mime…)
          └── types/media                    MediaFile, ImagePickerResult, errors
```

The component / preview / sheet / types / utils are **library-agnostic**. Only
`services/imagePickerService.ts` binds to `react-native-image-crop-picker`, so
swapping the library is a one-file change.

---

## 1. Install

Only one native dependency is required - `react-native-image-crop-picker`
(already installed). Permissions use React Native's built-in `PermissionsAndroid`
(Android) + the picker's own iOS prompts, so **no `react-native-permissions`**.

```sh
# from application/  (already done)
yarn add react-native-image-crop-picker

# iOS
cd ios && pod install && cd ..
```

After installing the native module, a **full native rebuild** is required
(`yarn android` / rebuild in Xcode) - a JS reload alone won't link it.

## 2. Native config (already applied in this repo)

**Android** - `android/app/src/main/AndroidManifest.xml`: `CAMERA`,
`READ_MEDIA_IMAGES`, `READ_EXTERNAL_STORAGE` (maxSdk 32), optional camera feature.

**iOS** - `ios/iiGrain/Info.plist`: `NSCameraUsageDescription`,
`NSPhotoLibraryUsageDescription`, `NSPhotoLibraryAddUsageDescription`.

---

## 3. Usage

### Single avatar (1:1 crop)
```tsx
const [photo, setPhoto] = useState<MediaFile[]>([]);

<AppImagePicker
  value={photo}
  aspectRatio={{ width: 1, height: 1 }}
  onChange={setPhoto}
  onDelete={() => setPhoto([])}
  onError={e => showToast(e.message, { type: 'error' })}
/>
```

### Multiple evidence images (up to 6)
```tsx
<AppImagePicker
  value={files}
  multiple
  maxSelection={6}
  maxSizeMB={8}
  onChange={setFiles}
  onDelete={f => setFiles(prev => prev.filter(x => x.id !== f.id))}
  onError={e => showToast(e.message, { type: 'error' })}
/>
```

### Headless (service only)
```ts
const result = await imagePickerService.pickImage({ crop: true });
if (result.status === 'success') upload(result.files);
else if (result.status === 'error') showToast(result.error.message);
// result.status === 'cancelled' → do nothing
```

---

## 4. Contract

- **Controlled**: parent owns `value: MediaFile[]`. Additions → `onChange(next)`;
  removals → `onDelete(file)`. Single mode = `multiple` omitted (cap of 1).
- **Errors are typed** (`ImagePickerError`), never alerts. A `PERMISSION_BLOCKED`
  error also auto-opens OS Settings.
- **Cancellation is not an error** - the result is `{ status: 'cancelled' }`.
- **Compression** is applied at pick time (`compressQuality`, default 0.8, longest
  edge capped at 2000px).
