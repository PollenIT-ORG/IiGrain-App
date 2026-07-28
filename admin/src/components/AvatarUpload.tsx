import { useEffect, useRef, useState, type ChangeEvent } from "react";
import {
  useUploadMyAvatarMutation,
  useRemoveMyAvatarMutation,
} from "../store/endpoints/profileApi";
import { showSuccess, showError } from "../lib/toast";

function errMsg(err: unknown): string {
  return (
    (err as { message?: string })?.message ??
    "Something went wrong. Please try again."
  );
}

const MAX_BYTES = 5 * 1024 * 1024;

interface Props {
  avatarUrl: string | null;
  name: string;
}

export default function AvatarUpload({ avatarUrl, name }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadAvatar, { isLoading: uploading }] = useUploadMyAvatarMutation();
  const [removeAvatar, { isLoading: removing }] = useRemoveMyAvatarMutation();
  const [camOpen, setCamOpen] = useState(false);

  const busy = uploading || removing;

  const initials = name
    .split(" ")
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function doUpload(file: Blob) {
    const form = new FormData();
    form.append("avatar", file, "avatar.jpg");
    try {
      await uploadAvatar(form).unwrap();
      showSuccess("Profile picture updated.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      showError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      showError("The image must be 5 MB or smaller.");
      return;
    }
    void doUpload(file);
  }

  async function onRemove() {
    try {
      await removeAvatar().unwrap();
      showSuccess("Profile picture removed.");
    } catch (err) {
      showError(errMsg(err));
    }
  }

  return (
    <div className="flex items-center gap-4">
      {avatarUrl ? (
        <img
          src={avatarUrl}
          alt="Profile"
          className="h-16 w-16 rounded-full object-cover ring-1 ring-gray-200"
        />
      ) : (
        <span className="grid h-16 w-16 place-items-center rounded-full bg-primary text-xl font-semibold text-white">
          {initials}
        </span>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="btn-secondary text-sm"
          >
            {uploading ? "Uploading..." : "Upload photo"}
          </button>
          <button
            type="button"
            onClick={() => setCamOpen(true)}
            disabled={busy}
            className="btn-secondary text-sm"
          >
            Take photo
          </button>
          {avatarUrl && (
            <button
              type="button"
              onClick={onRemove}
              disabled={busy}
              className="text-sm font-medium text-danger hover:underline disabled:opacity-50"
            >
              {removing ? "Removing..." : "Remove"}
            </button>
          )}
        </div>
        <p className="text-xs text-gray-500">
          JPG, PNG or WEBP, up to 5 MB. Choose from your device or take a photo.
        </p>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onFile}
      />

      {camOpen && (
        <CameraModal
          onClose={() => setCamOpen(false)}
          onCapture={(blob) => {
            setCamOpen(false);
            void doUpload(blob);
          }}
        />
      )}
    </div>
  );
}

function CameraModal({
  onClose,
  onCapture,
}: {
  onClose: () => void;
  onCapture: (blob: Blob) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => undefined);
        }
        setReady(true);
      } catch {
        setError(
          "Could not access the camera. Allow camera permission, or use Upload photo instead."
        );
      }
    }
    void start();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    const size = Math.min(video.videoWidth, video.videoHeight);
    if (size === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = (video.videoWidth - size) / 2;
    const sy = (video.videoHeight - size) / 2;
    ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob);
      },
      "image/jpeg",
      0.9
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-panel card w-full max-w-md p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="mb-3 text-base font-semibold text-gray-900">
          Take a photo
        </h3>
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <div className="overflow-hidden rounded-lg bg-black">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-64 w-full object-cover"
            />
          </div>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onClose}>
            Cancel
          </button>
          {!error && (
            <button
              type="button"
              className="btn-primary"
              onClick={capture}
              disabled={!ready}
            >
              Capture
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
