import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import ApiResponse from "../utils/ApiResponse.js";
import * as service from "../services/fieldModule.service.js";
import type { ModuleKey } from "../models/fieldModule.model.js";
import type {
  CreateDocumentBody,
  ListDocumentsQuery,
  UploadDocumentBody,
} from "../validators/fieldModule.schema.js";
import { uploadMonitoringFile } from "../services/upload.service.js";
import type {
  DocumentModule,
  DocumentKind,
} from "../models/fieldModuleDocument.model.js";

/**
 * Field monitoring modules: training, soil samples, irrigation, and the rest.
 *
 * Every handler passes the caller straight through to the service, which is
 * where the ownership gate lives. Nothing is decided here.
 */

function actor(req: Request): service.Actor {
  const id = req.user?.sub;
  const role = req.user?.role;
  if (!id || !role) throw ApiError.unauthorized("Authentication required.");
  return { id, role };
}

/** The three ids every route in this file carries. */
function target(req: Request): { fieldId: string; programId: string } {
  return { fieldId: req.params.fieldId, programId: req.params.programId };
}

function moduleOf(req: Request): ModuleKey {
  return req.params.module as ModuleKey;
}

// ---------------------------------------------------------------------------
// The module list
// ---------------------------------------------------------------------------

export const getModules = asyncHandler(async (req: Request, res: Response) => {
  const { context, modules } = await service.getModuleSummary({
    ...target(req),
    actor: actor(req),
  });
  return ApiResponse.send(res, 200, "Modules fetched.", { context, modules });
});

export const getFarmPrograms = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await service.getFarmPrograms(req.params.farmId, actor(req));
    return ApiResponse.send(res, 200, "Farm programs fetched.", data);
  }
);

export const getFarmModules = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await service.getFarmModuleSummary({
      farmId: req.params.farmId,
      programId: req.params.programId,
      actor: actor(req),
    });
    return ApiResponse.send(res, 200, "Farm modules fetched.", data);
  }
);

export const listFarmModuleRecords = asyncHandler(
  async (req: Request, res: Response) => {
    const data = await service.getFarmRecords({
      module: moduleOf(req),
      farmId: req.params.farmId,
      programId: req.params.programId,
      actor: actor(req),
    });
    return ApiResponse.send(res, 200, "Farm records fetched.", data);
  }
);

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export const listModuleRecords = asyncHandler(
  async (req: Request, res: Response) => {
    const { context, records } = await service.getRecords({
      module: moduleOf(req),
      ...target(req),
      actor: actor(req),
    });
    return ApiResponse.send(res, 200, "Records fetched.", { context, records });
  }
);

export const getModuleRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const record = await service.getRecord({
      module: moduleOf(req),
      id: req.params.id,
      ...target(req),
      actor: actor(req),
    });
    return ApiResponse.send(res, 200, "Record fetched.", { record });
  }
);

export const createModuleRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const record = await service.addRecord({
      module: moduleOf(req),
      ...target(req),
      data: req.body as Record<string, unknown>,
      actor: actor(req),
    });
    return ApiResponse.send(res, 201, "Record added.", { record });
  }
);

export const updateModuleRecord = asyncHandler(
  async (req: Request, res: Response) => {
    const record = await service.editRecord({
      module: moduleOf(req),
      id: req.params.id,
      ...target(req),
      data: req.body as Record<string, unknown>,
      actor: actor(req),
    });
    return ApiResponse.send(res, 200, "Record updated.", { record });
  }
);

export const deleteModuleRecord = asyncHandler(
  async (req: Request, res: Response) => {
    await service.removeRecord({
      module: moduleOf(req),
      id: req.params.id,
      ...target(req),
      actor: actor(req),
    });
    return ApiResponse.send(res, 200, "Record deleted.");
  }
);

// ---------------------------------------------------------------------------
// Documents
// ---------------------------------------------------------------------------

export const listModuleDocuments = asyncHandler(
  async (req: Request, res: Response) => {
    const q = req.query as unknown as ListDocumentsQuery;
    const documents = await service.getDocuments({
      ...target(req),
      module: q.module as DocumentModule | undefined,
      recordId: q.recordId,
      actor: actor(req),
    });
    return ApiResponse.send(res, 200, "Documents fetched.", { documents });
  }
);

export const createModuleDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const body = req.body as CreateDocumentBody;
    const document = await service.addDocument({
      ...target(req),
      module: body.module as DocumentModule,
      recordId: body.recordId ?? null,
      kind: body.kind as DocumentKind | undefined,
      name: body.name,
      url: body.url,
      mimeType: body.mimeType ?? null,
      sizeBytes: body.sizeBytes ?? null,
      actor: actor(req),
    });
    return ApiResponse.send(res, 201, "Document attached.", { document });
  }
);

/**
 * Drag and drop from the app or the panel: the file goes to storage and the
 * record is written in one call, because that is what the user experiences as
 * a single action.
 */
export const uploadModuleDocument = asyncHandler(
  async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) throw ApiError.badRequest("Please attach a file.");

    const body = req.body as UploadDocumentBody;
    const saved = await uploadMonitoringFile(file);

    const document = await service.addDocument({
      ...target(req),
      module: body.module as DocumentModule,
      recordId: body.recordId ?? null,
      kind: body.kind as DocumentKind | undefined,
      name: saved.name,
      url: saved.url,
      mimeType: saved.mimeType,
      sizeBytes: saved.sizeBytes,
      actor: actor(req),
    });
    return ApiResponse.send(res, 201, "File uploaded.", { document });
  }
);

export const deleteModuleDocument = asyncHandler(
  async (req: Request, res: Response) => {
    await service.removeDocument({
      documentId: req.params.documentId,
      ...target(req),
      actor: actor(req),
    });
    return ApiResponse.send(res, 200, "Document removed.");
  }
);
