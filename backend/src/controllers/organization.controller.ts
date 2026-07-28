import asyncHandler from "../utils/asyncHandler.js";
import ApiResponse from "../utils/ApiResponse.js";
import ApiError from "../utils/ApiError.js";
import * as orgService from "../services/organization.service.js";
import type {
  CreateOrgBody,
  UpdateOrgBody,
  ListOrgsQuery,
  AssignUserBody,
} from "../validators/org.schema.js";

export const createOrganization = asyncHandler(async (req, res) => {
  const org = await orgService.createOrganization(req.body as CreateOrgBody);
  return ApiResponse.send(res, 201, "Organization created successfully.", {
    organization: org,
  });
});

export const listOrganizations = asyncHandler(async (req, res) => {
  const q = req.query as unknown as ListOrgsQuery;
  const { organizations, meta } = await orgService.getOrganizations({
    page: q.page,
    limit: q.limit,
    status: q.status,
    search: q.search,
  });
  return ApiResponse.send(
    res,
    200,
    "Organizations fetched.",
    { organizations },
    meta
  );
});

export const getOrganization = asyncHandler(async (req, res) => {
  const data = await orgService.getOrganizationWithMembers(req.params.id);
  return ApiResponse.send(res, 200, "Organization fetched.", data);
});

export const getCurrentOrganization = asyncHandler(async (_req, res) => {
  const organization = await orgService.getCurrentOrganization();
  return ApiResponse.send(res, 200, "Current organization fetched.", {
    organization,
  });
});

export const updateOrganization = asyncHandler(async (req, res) => {
  const org = await orgService.editOrganization(
    req.params.id,
    req.body as UpdateOrgBody
  );
  return ApiResponse.send(res, 200, "Organization updated successfully.", {
    organization: org,
  });
});

export const deleteOrganization = asyncHandler(async (req, res) => {
  await orgService.removeOrganization(req.params.id);
  return ApiResponse.send(res, 200, "Organization deleted successfully.");
});

function fileFrom(req: unknown): { buffer: Buffer; size?: number } {
  const file = (req as { file?: { buffer: Buffer; size?: number } }).file;
  if (!file) throw ApiError.badRequest("No image file was uploaded.");
  return file;
}

export const uploadOrgLogo = asyncHandler(async (req, res) => {
  const organization = await orgService.setLogo(req.params.id, fileFrom(req));
  return ApiResponse.send(res, 200, "Logo updated.", { organization });
});

export const removeOrgLogo = asyncHandler(async (req, res) => {
  const organization = await orgService.removeLogo(req.params.id);
  return ApiResponse.send(res, 200, "Logo removed.", { organization });
});

export const uploadOrgFavicon = asyncHandler(async (req, res) => {
  const organization = await orgService.setFavicon(req.params.id, fileFrom(req));
  return ApiResponse.send(res, 200, "Favicon updated.", { organization });
});

export const removeOrgFavicon = asyncHandler(async (req, res) => {
  const organization = await orgService.removeFavicon(req.params.id);
  return ApiResponse.send(res, 200, "Favicon removed.", { organization });
});

export const assignUser = asyncHandler(async (req, res) => {
  const { userId } = req.body as AssignUserBody;
  const user = await orgService.assignUser(req.params.id, userId);
  return ApiResponse.send(res, 200, "User assigned to organization.", {
    user,
  });
});

export const unassignUser = asyncHandler(async (req, res) => {
  await orgService.unassignUser(req.params.id, req.params.userId);
  return ApiResponse.send(res, 200, "User removed from organization.");
});
