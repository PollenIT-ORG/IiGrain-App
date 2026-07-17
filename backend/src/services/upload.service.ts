import type { UploadApiResponse } from "cloudinary";
import cloudinary from "../config/cloudinary.js";
import ApiError from "../utils/ApiError.js";
import { EVIDENCE_SIZE } from "../config/multer.js";

const EVIDENCE_FOLDER = "farmer_evidence";

const DOCUMENTS_FOLDER = "farmer_documents";

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
