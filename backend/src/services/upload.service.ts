import type { UploadApiResponse } from "cloudinary";
import cloudinary from "../config/cloudinary.js";
import ApiError from "../utils/ApiError.js";
import { EVIDENCE_SIZE } from "../config/multer.js";

const EVIDENCE_FOLDER = "farmer_evidence";

const DOCUMENTS_FOLDER = "farmer_documents";

const AVATAR_FOLDER = "farmer_avatars";

const VIDEO_EXTS = new Set(["mp4", "mov", "webm", "m4v", "3gp"]);

function isVideoName(name: string | undefined): boolean {
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  return VIDEO_EXTS.has(ext);
}

function uploadBuffer(buffer: Buffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: EVIDENCE_FOLDER, resource_type: "auto" },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(
            ApiError.badRequest(
              "Evidence upload failed. Please try again with a valid image or video."
            )
          );
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

interface EvidenceFile {
  buffer: Buffer;
  originalname?: string;
  size?: number;
}

export async function uploadEvidenceImages(
  files: EvidenceFile[]
): Promise<string[]> {
  if (!files.length) {
    throw ApiError.badRequest(
      "No file was uploaded. Please attach a photo or video."
    );
  }
  if (files.length > 5) {
    throw ApiError.badRequest("You can upload at most 5 files at a time.");
  }

  for (const f of files) {
    const bytes = f.size ?? f.buffer.length;
    const isVideo = isVideoName(f.originalname);
    const cap = isVideo ? EVIDENCE_SIZE.videoMax : EVIDENCE_SIZE.imageMax;
    if (bytes > cap) {
      const mb = Math.round(cap / (1024 * 1024));
      throw ApiError.badRequest(
        isVideo
          ? `Each video must be ${mb} MB or smaller.`
          : `Each image must be ${mb} MB or smaller.`
      );
    }
  }

  return Promise.all(files.map((f) => uploadBuffer(f.buffer)));
}

const AVATAR_MAX = 5 * 1024 * 1024;

export function uploadAvatarImage(file: {
  buffer: Buffer;
  size?: number;
}): Promise<string> {
  const bytes = file.size ?? file.buffer.length;
  if (bytes > AVATAR_MAX) {
    throw ApiError.badRequest("The profile picture must be 5 MB or smaller.");
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: AVATAR_FOLDER,
        resource_type: "image",
        transformation: [
          { width: 512, height: 512, crop: "fill", gravity: "face" },
        ],
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(
            ApiError.badRequest(
              "Profile picture upload failed. Please try again with a valid image."
            )
          );
        }
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

const BRANDING_FOLDER = "farmer_branding";
const BRANDING_MAX = 5 * 1024 * 1024;

// Uploads an organization logo or favicon. The logo keeps its aspect ratio
// (bounded); the favicon is squared small.
export function uploadBrandingImage(
  file: { buffer: Buffer; size?: number },
  kind: "logo" | "favicon"
): Promise<string> {
  const bytes = file.size ?? file.buffer.length;
  if (bytes > BRANDING_MAX) {
    throw ApiError.badRequest("The image must be 5 MB or smaller.");
  }
  const transformation =
    kind === "favicon"
      ? [{ width: 64, height: 64, crop: "fill" }]
      : [{ width: 512, height: 256, crop: "limit" }];
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: BRANDING_FOLDER, resource_type: "image", transformation },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(
            ApiError.badRequest(
              "Image upload failed. Please try again with a valid image."
            )
          );
        }
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });
}

const SIGNATURE_FOLDER = "farmer_signatures";
const SIGNATURE_MAX = 2 * 1024 * 1024;

// Stores a drawn contract signature. The client sends a PNG data URL from its
// canvas; we decode it here rather than trusting a client-side upload.
export function uploadSignatureDataUrl(dataUrl: string): Promise<string> {
  const match = /^data:image\/(png|jpe?g);base64,([A-Za-z0-9+/=]+)$/.exec(
    dataUrl.trim()
  );
  if (!match) {
    throw ApiError.badRequest("The signature image is not a valid PNG or JPEG.");
  }
  const buffer = Buffer.from(match[2], "base64");
  if (buffer.length > SIGNATURE_MAX) {
    throw ApiError.badRequest("The signature image is too large.");
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: SIGNATURE_FOLDER, resource_type: "image" },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(
            ApiError.badRequest("Could not save the signature. Please try again.")
          );
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });
}

export interface UploadedDocument {
  url: string;
  bytes: number | null;
}

export function uploadDocumentBuffer(buffer: Buffer): Promise<UploadedDocument> {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: DOCUMENTS_FOLDER, resource_type: "auto" },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(
            ApiError.badRequest("Document upload failed. Please try again.")
          );
        }
        resolve({ url: result.secure_url, bytes: result.bytes ?? null });
      }
    );
    stream.end(buffer);
  });
}
