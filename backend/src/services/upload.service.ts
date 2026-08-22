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

const CONTRACT_FOLDER = "farmer_contracts";
const CONTRACT_PDF_MAX = 10 * 1024 * 1024;

/**
 * Stores a contract PDF - either the blank one a program administrator uploads,
 * or the signed copy generated once a producer signs it.
 */
const MONITORING_FOLDER = "farmer_monitoring";
const MONITORING_MAX = 10 * 1024 * 1024;

/**
 * A file attached to a field monitoring record: a lab report, a training
 * certificate, or a photo from the field.
 *
 * PDFs and Word files go up as raw assets, images as images, because
 * Cloudinary treats the two differently and a PDF uploaded as an image comes
 * back unreadable.
 */
export async function uploadMonitoringFile(file: {
  buffer: Buffer;
  originalname?: string;
  mimetype?: string;
  size?: number;
}): Promise<{ url: string; name: string; mimeType: string | null; sizeBytes: number }> {
  const bytes = file.size ?? file.buffer.length;
  if (bytes > MONITORING_MAX) {
    throw ApiError.badRequest("That file is larger than 10 MB.");
  }

  const name = (file.originalname ?? "file").slice(0, 200);
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  const isImage = ["jpg", "jpeg", "png", "webp", "heic"].includes(ext);
  const publicId = name
    .replace(/\.[^.]+$/, "")
    .replace(/[^\w-]+/g, "_")
    .slice(0, 80);

  const url = await new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: MONITORING_FOLDER,
        resource_type: isImage ? "image" : "raw",
        public_id: `${publicId}_${Date.now()}`,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(
            ApiError.badRequest("Could not save the file. Please try again.")
          );
        }
        resolve(result.secure_url);
      }
    );
    stream.end(file.buffer);
  });

  return { url, name, mimeType: file.mimetype ?? null, sizeBytes: bytes };
}

export async function uploadContractPdf(
  buffer: Buffer,
  filename: string
): Promise<string> {
  if (buffer.length > CONTRACT_PDF_MAX) {
    throw ApiError.badRequest("The PDF is too large. The limit is 10 MB.");
  }
  // Stored as a raw asset with NO .pdf in the public id: Cloudinary blocks
  // delivery of anything it recognises as a PDF, so a ".pdf" id 401s. The file
  // is served back to browsers by our own endpoint, which sets the PDF headers.
  const publicId = filename.replace(/\.pdf$/i, "").replace(/[^\w-]+/g, "_");
  const url = await new Promise<string>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: CONTRACT_FOLDER,
        resource_type: "raw",
        public_id: `${publicId}_${Date.now()}`,
      },
      (error, result?: UploadApiResponse) => {
        if (error || !result) {
          return reject(
            ApiError.badRequest("Could not save the PDF. Please try again.")
          );
        }
        resolve(result.secure_url);
      }
    );
    stream.end(buffer);
  });

  // A contract nobody can open is worse than a failed upload, so check the
  // stored file can actually be read back before we record it.
  const check = await fetch(url);
  if (!check.ok) {
    await cloudinary.uploader
      .destroy(publicIdFromUrl(url), { resource_type: "raw" })
      .catch(() => undefined);
    throw ApiError.badRequest(
      "The PDF was saved but could not be read back. Please try again."
    );
  }
  return url;
}

/** The storage id inside a delivery URL, e.g. "farmer_contracts/deal_17123". */
function publicIdFromUrl(url: string): string {
  const match = /\/raw\/upload\/(?:v\d+\/)?(.+)$/.exec(url);
  return match ? decodeURIComponent(match[1]) : url;
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
