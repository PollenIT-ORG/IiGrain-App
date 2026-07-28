import multer from "multer";
import type { Options as MulterOptions } from "multer";
import ApiError from "../utils/ApiError.js";

const MB = 1024 * 1024;

export const DEFAULT_MAX_FILE_SIZE = 5 * MB;

interface MakeUploaderOptions {
  maxFileSize?: number;
  maxFiles?: number;
  allowedExtensions?: string[];
  typeLabel?: string;
  perExtensionMaxSize?: Record<string, number>;
}

export function makeUploader(opts: MakeUploaderOptions = {}) {
  const {
    maxFileSize = DEFAULT_MAX_FILE_SIZE,
    maxFiles,
    allowedExtensions,
    typeLabel,
    perExtensionMaxSize,
  } = opts;

  const config: MulterOptions = {
    storage: multer.memoryStorage(),
    limits: {
      fileSize: maxFileSize,
      ...(maxFiles ? { files: maxFiles } : {}),
    },
  };

  const hasExtFilter = allowedExtensions && allowedExtensions.length > 0;
  if (hasExtFilter || perExtensionMaxSize) {
    const allowed = (allowedExtensions ?? []).map((e) =>
      e.toLowerCase().replace(/^\./, "")
    );
    config.fileFilter = (_req, file, cb) => {
      const ext = file.originalname.split(".").pop()?.toLowerCase() ?? "";

      if (hasExtFilter && !allowed.includes(ext)) {
        const label = typeLabel ?? allowed.map((e) => `.${e}`).join(" or ");
        return cb(ApiError.badRequest(`Only ${label} files are supported.`));
      }

      const cap = perExtensionMaxSize?.[ext];
      const declaredSize = (file as { size?: number }).size;
      if (cap && typeof declaredSize === "number" && declaredSize > cap) {
        const mb = Math.round(cap / MB);
        return cb(
          ApiError.badRequest(`.${ext} files must be ${mb} MB or smaller.`)
        );
      }

      cb(null, true);
    };
  }

  return multer(config);
}

export const excelUpload = makeUploader({
  allowedExtensions: ["xlsx", "xls"],
  typeLabel: ".xlsx or .xls",
  maxFileSize: 5 * MB,
});

const EVIDENCE_IMAGE_MAX = 5 * MB;
const EVIDENCE_VIDEO_MAX = 50 * MB;

export const evidenceUpload = makeUploader({
  allowedExtensions: [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "heic",
    "mp4",
    "mov",
    "webm",
    "m4v",
    "3gp",
  ],
  typeLabel: "JPG, PNG, WEBP, HEIC image or MP4, MOV, WEBM video",
  maxFileSize: EVIDENCE_VIDEO_MAX,
  maxFiles: 5,
  perExtensionMaxSize: {
    jpg: EVIDENCE_IMAGE_MAX,
    jpeg: EVIDENCE_IMAGE_MAX,
    png: EVIDENCE_IMAGE_MAX,
    webp: EVIDENCE_IMAGE_MAX,
    heic: EVIDENCE_IMAGE_MAX,
  },
});

export const imageUpload = evidenceUpload;

export const EVIDENCE_SIZE = {
  imageMax: EVIDENCE_IMAGE_MAX,
  videoMax: EVIDENCE_VIDEO_MAX,
} as const;

export const avatarUpload = makeUploader({
  allowedExtensions: ["jpg", "jpeg", "png", "webp", "heic"],
  typeLabel: "JPG, PNG, WEBP or HEIC image",
  maxFileSize: 5 * MB,
  maxFiles: 1,
});

export const documentUpload = makeUploader({
  allowedExtensions: ["pdf", "jpg", "jpeg", "png", "webp", "heic", "doc", "docx"],
  typeLabel: "PDF, image or Word document",
  maxFileSize: 10 * MB,
});
