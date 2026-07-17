import ApiError from "../utils/ApiError.js";
import prisma from "../db/prisma.js";
import { notifyUser } from "./notification.service.js";
import { visitStartedEmail } from "./emailTemplates.js";
import {
  assessorCanAccessField,
  findFieldWithFarmer,
  resolveProgramForField,
} from "../models/assessmentMobile.model.js";
import {
  createVisit,
  endVisit,
  markVisitArrived,
  updateVisitLocation,
  findActiveVisitForAssessor,
  findActiveVisitForFarmer,
  findVisitById,
  listActiveVisits,
  type PublicVisit,
} from "../models/visit.model.js";

async function fieldDestination(
  fieldId: string
): Promise<{ lat: number | null; lng: number | null }> {
  const f = await prisma.fields.findFirst({
    where: { id: fieldId, deleted_at: null },
    select: { latitude: true, longitude: true },
  });
  if (f && f.latitude !== null && f.longitude !== null) {
    return { lat: Number(f.latitude), lng: Number(f.longitude) };
  }
  return { lat: null, lng: null };
}

export interface StartVisitInput {
  fieldId: string;
}

export async function startVisit(
  assessorId: string,
  input: StartVisitInput
): Promise<PublicVisit> {
  const field = await findFieldWithFarmer(input.fieldId);
  if (!field) throw ApiError.notFound("Field not found.");

  const canAccess = await assessorCanAccessField(assessorId, input.fieldId);
  if (!canAccess) {
    throw ApiError.forbidden(
      "You can't visit this field - it isn't assigned to you for assessment."
    );
  }

  const existing = await findActiveVisitForAssessor(assessorId);
  if (existing) {
    throw ApiError.conflict(
      "You already have an active visit. End it before starting another."
    );
  }

  const dest = await fieldDestination(input.fieldId);
  const programId = await resolveProgramForField(input.fieldId);

  const visit = await createVisit({
    assessorId,
    farmerId: field.farmer_id,
    programId,
    fieldId: input.fieldId,
    destLatitude: dest.lat,
    destLongitude: dest.lng,
  });

  void notifyUser({
    userId: field.farmer_id,
    type: "assessor_visit_started",
    title: "Your assessor is on the way",
    body: visit.assessor_name
      ? `${visit.assessor_name} has started a visit to "${field.name}".`
      : `An assessor has started a visit to "${field.name}".`,
    data: { visitId: visit.id, fieldId: field.id },
    emailFor: (r) =>
      visitStartedEmail({
        fullName: r.fullName,
        assessorName: visit.assessor_name,
        fieldName: field.name,
      }),
  });

  return visit;
}

async function loadOwnedVisit(
  visitId: string,
  assessorId: string
): Promise<PublicVisit> {
  const visit = await findVisitById(visitId);
  if (!visit) throw ApiError.notFound("Visit not found.");
  if (visit.assessor_id !== assessorId) {
    throw ApiError.forbidden("This visit belongs to another assessor.");
  }
  return visit;
}

export async function pushLocation(
  visitId: string,
  assessorId: string,
  lat: number,
  lng: number
): Promise<PublicVisit> {
  await loadOwnedVisit(visitId, assessorId);
  const updated = await updateVisitLocation(visitId, lat, lng);
  if (!updated) {
    throw ApiError.badRequest("This visit is no longer active.");
  }
  return updated;
}

export async function arriveVisit(
  visitId: string,
  assessorId: string
): Promise<PublicVisit> {
  await loadOwnedVisit(visitId, assessorId);
  const updated = await markVisitArrived(visitId);
  if (!updated) {
    throw ApiError.badRequest("Visit can't be marked arrived (not en route).");
  }
  return updated;
}

export async function finishVisit(
  visitId: string,
  assessorId: string,
  outcome: "completed" | "cancelled"
): Promise<PublicVisit> {
  await loadOwnedVisit(visitId, assessorId);
  const updated = await endVisit(visitId, outcome);
  if (!updated) {
    throw ApiError.badRequest("This visit is no longer active.");
  }
  return updated;
}

export async function getMyAssessorVisit(
  assessorId: string
): Promise<PublicVisit | null> {
  return findActiveVisitForAssessor(assessorId);
}

export async function getMyFarmerVisit(
  farmerId: string
): Promise<PublicVisit | null> {
  return findActiveVisitForFarmer(farmerId);
}

export async function getVisitForViewer(
  visitId: string,
  viewer: { id: string; role: string }
): Promise<PublicVisit> {
  const visit = await findVisitById(visitId);
  if (!visit) throw ApiError.notFound("Visit not found.");
  const isAdmin = viewer.role === "super_admin" || viewer.role === "admin";
  if (
    !isAdmin &&
    visit.assessor_id !== viewer.id &&
    visit.farmer_id !== viewer.id
  ) {
    throw ApiError.forbidden("You don't have access to this visit.");
  }
  return visit;
}

export async function getActiveVisits(): Promise<PublicVisit[]> {
  return listActiveVisits();
}
