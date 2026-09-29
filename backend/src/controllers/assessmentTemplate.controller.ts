import type { Request, Response } from "express";
import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as templates from "../services/assessmentTemplate.service.js";
import type {
  CreateTemplateBody,
  ListTemplatesQuery,
  UpdateTemplateBody,
} from "../validators/assessment.schema.js";

export function actorOf(req: Request): templates.TemplateActor {
  const id = req.user?.sub;
  if (!id) throw ApiError.unauthorized("Authentication required.");
  return { id, role: req.user!.role };
}

export const listTemplates = asyncHandler(async (req: Request, res: Response) => {
  const query = req.query as unknown as ListTemplatesQuery;
  // Asked for a page: the Assessments list. Otherwise every template, for the pickers.
  if (query.page) {
    const { templates: page, meta } = await templates.getTemplatesPage(actorOf(req), {
      page: query.page,
      limit: query.limit,
      search: query.search,
      kind: query.kind,
    });
    return ApiResponse.send(res, 200, "Templates fetched.", { templates: page }, meta);
  }
  const list = await templates.getTemplates(actorOf(req));
  return ApiResponse.send(res, 200, "Templates fetched.", { templates: list });
});

export const getTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await templates.getVisibleTemplate(req.params.id, actorOf(req));
  ApiResponse.send(res, 200, "Template fetched.", { template });
});

export const createTemplate = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as CreateTemplateBody;
  const template = await templates.addTemplate(actorOf(req), body);
  ApiResponse.send(res, 201, "Template created.", { template });
});

export const updateTemplate = asyncHandler(async (req: Request, res: Response) => {
  const body = req.body as UpdateTemplateBody;
  const template = await templates.editTemplate(req.params.id, actorOf(req), body);
  ApiResponse.send(res, 200, "Template updated.", { template });
});

export const deleteTemplate = asyncHandler(async (req: Request, res: Response) => {
  await templates.removeTemplate(req.params.id, actorOf(req));
  ApiResponse.send(res, 200, "Template deleted.");
});

export const makeTemplateGlobal = asyncHandler(async (req: Request, res: Response) => {
  const template = await templates.makeGlobal(req.params.id, actorOf(req));
  ApiResponse.send(res, 200, "Global template updated.", { template });
});

export const lockTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await templates.setTemplateLocked(req.params.id, actorOf(req), true);
  ApiResponse.send(res, 200, "Assessment locked.", { template });
});

export const unlockTemplate = asyncHandler(async (req: Request, res: Response) => {
  const template = await templates.setTemplateLocked(req.params.id, actorOf(req), false);
  ApiResponse.send(res, 200, "Assessment unlocked.", { template });
});
