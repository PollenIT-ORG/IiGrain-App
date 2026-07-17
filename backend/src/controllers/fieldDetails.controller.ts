import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as service from "../services/fieldDetails.service.js";
import { uploadDocumentBuffer } from "../services/upload.service.js";
import type {
  FieldDetailsQuery,
  UpsertSoilBody,
} from "../validators/fieldDetails.schema.js";

function actorOf(req: Request): service.Actor {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return { id, role: req.user!.role };
}

export const getFieldDetails = asyncHandler(
  async (req: Request, res: Response) => {
    const { tab } = req.query as unknown as FieldDetailsQuery;
    const result = await service.getFieldDetails(req.params.id, tab, actorOf(req));
    return ApiResponse.send(res, 200, "Field details fetched.", result);
  }
);

export const getSoil = asyncHandler(async (req: Request, res: Response) => {
  const soil = await service.getSoil(req.params.id, actorOf(req));
  return ApiResponse.send(res, 200, "Soil record fetched.", { soil });
});

export const saveSoil = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpsertSoilBody;
  const soil = await service.saveSoil(req.params.id, body, actorOf(req));
  return ApiResponse.send(res, 200, "Soil record saved.", { soil });
});

export const listDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const documents = await service.getDocuments(req.params.id, actorOf(req));
    return ApiResponse.send(res, 200, "Documents fetched.", { documents });
  }
);

export const uploadDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const actor = actorOf(req);
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) {
      throw ApiError.badRequest("No file uploaded. Please attach a document.");
    }

    const uploaded = await uploadDocumentBuffer(file.buffer);

    const name =
      (req.body?.name as string | undefined)?.trim() ||
      file.originalname ||
      "Document";

    const document = await service.addDocument(
      req.params.id,
      {
        name,
        url: uploaded.url,
        mimeType: file.mimetype ?? null,
        sizeBytes: uploaded.bytes,
      },
      actor
    );
    return ApiResponse.send(res, 201, "Document uploaded.", { document });
  }
);

export const deleteDocument = asyncHandler(
  async (req: Request, res: Response) => {
    await service.removeDocument(
      req.params.id,
      req.params.docId,
      actorOf(req)
    );
    return ApiResponse.send(res, 200, "Document deleted.");
  }
);

export const getAssessmentComparison = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await service.getAssessmentComparison(
      req.params.id,
      actorOf(req)
    );
    return ApiResponse.send(res, 200, "Assessment comparison fetched.", result);
  }
);
