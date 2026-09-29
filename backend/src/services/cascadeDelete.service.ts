import type { Prisma } from "@prisma/client";
import prisma from "../db/prisma.js";
import { softDeleteTemplates } from "../models/assessmentTemplate.model.js";

/**
 * Deleting something deletes what belongs to it.
 *
 * A program's enrollments, assessments and survey submissions only mean
 * anything as part of that program; a farmer's farms and fields only mean
 * anything as that farmer's. Left behind they are counted in totals and shown
 * in lists that no longer have an owner to explain them, which is worse than
 * losing them - so removing the main record removes its record with it.
 *
 * One rule decides how: a table that carries `deleted_at` is marked deleted
 * (nothing in the app reads it again, and the row is still there in the
 * database if it is ever needed for an audit); a table that carries no such
 * column is removed outright, because leaving it would leave it in the counts.
 *
 * Everything runs in a single transaction, so a program or a person is either
 * fully gone or fully there.
 */

export interface DeletionLine {
  label: string;
  count: number;
}

type Tx = Prisma.TransactionClient;

const ALIVE = { deleted_at: null } as const;

function stamp(now: Date) {
  return { deleted_at: now };
}

// --------------------------------- Programs --------------------------------

/** What deleting this program takes with it, for the confirmation. */
export async function summarizeProgramDeletion(
  programId: string
): Promise<DeletionLine[]> {
  const [enrollments, assessments, submissions, visits] = await Promise.all([
    prisma.program_enrollments.count({ where: { program_id: programId, ...ALIVE } }),
    prisma.field_assessments.count({ where: { program_id: programId } }),
    prisma.program_admin_survey_submissions.count({
      where: { survey: { program_id: programId }, ...ALIVE },
    }),
    prisma.field_visits.count({ where: { program_id: programId } }),
  ]);
  const [survey, assessmentCopy] = await Promise.all([
    prisma.program_admin_surveys.count({ where: { program_id: programId, ...ALIVE } }),
    prisma.assessment_templates.count({ where: { program_id: programId, ...ALIVE } }),
  ]);

  return [
    { label: "Enrolled farmers", count: enrollments },
    { label: "Survey", count: survey },
    { label: "Assessment template copy", count: assessmentCopy },
    { label: "Survey submissions and their contracts", count: submissions },
    { label: "Field assessments", count: assessments },
    { label: "Field visits", count: visits },
  ].filter((l) => l.count > 0);
}

async function cascadeProgram(tx: Tx, programId: string, now: Date): Promise<void> {
  const enrollments = await tx.program_enrollments.findMany({
    where: { program_id: programId, ...ALIVE },
    select: { id: true },
  });
  const enrollmentIds = enrollments.map((e) => e.id);
  if (enrollmentIds.length) {
    await tx.program_enrollment_fields.updateMany({
      where: { enrollment_id: { in: enrollmentIds }, ...ALIVE },
      data: { ...stamp(now), updated_at: now },
    });
    await tx.program_enrollments.updateMany({
      where: { id: { in: enrollmentIds } },
      data: { ...stamp(now), updated_at: now },
    });
  }

  // The survey a producer applies through, everything sent to it, and the
  // contracts that came out of it.
  const surveys = await tx.program_admin_surveys.findMany({
    where: { program_id: programId, ...ALIVE },
    select: { id: true },
  });
  const surveyIds = surveys.map((s) => s.id);
  if (surveyIds.length) {
    const submissions = await tx.program_admin_survey_submissions.findMany({
      where: { survey_id: { in: surveyIds }, ...ALIVE },
      select: { id: true },
    });
    const submissionIds = submissions.map((s) => s.id);
    if (submissionIds.length) {
      // No deleted_at of its own, and a contract without its submission is
      // nothing.
      await tx.program_admin_survey_contracts.deleteMany({
        where: { submission_id: { in: submissionIds } },
      });
      await tx.program_admin_survey_submissions.updateMany({
        where: { id: { in: submissionIds } },
        data: { ...stamp(now), updated_at: now },
      });
    }
    await tx.program_admin_surveys.updateMany({
      where: { id: { in: surveyIds } },
      data: { ...stamp(now), updated_at: now },
    });
  }

  await tx.assessment_responses.updateMany({
    where: { program_id: programId, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  await tx.assessment_records.updateMany({
    where: { program_id: programId, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  await tx.assessment_category_evidence.updateMany({
    where: { program_id: programId, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  // Neither of these carries deleted_at, so they go for real.
  await tx.field_assessments.deleteMany({ where: { program_id: programId } });
  await tx.field_visits.deleteMany({ where: { program_id: programId } });

  // The program's own copy of its assessment template only ever served this program.
  const copies = await tx.assessment_templates.findMany({
    where: { program_id: programId, ...ALIVE },
    select: { id: true },
  });
  await softDeleteTemplates(tx, copies.map((c) => c.id), now);

  await tx.programs.updateMany({
    where: { id: programId, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
}

// A cascade is a long run of statements against a database that is not on this
// machine, so it needs longer than the five seconds Prisma allows by default.
const TX_LIMITS = { timeout: 60_000, maxWait: 20_000 };

export async function deleteProgramCascade(programId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const found = await tx.programs.findFirst({
      where: { id: programId, ...ALIVE },
      select: { id: true },
    });
    if (!found) return false;
    await cascadeProgram(tx, programId, new Date());
    return true;
  }, TX_LIMITS);
}

// ---------------------------------- People ---------------------------------

/** What deleting this person takes with it, for the confirmation. */
export async function summarizeUserDeletion(
  userId: string
): Promise<DeletionLine[]> {
  const [
    farms,
    fields,
    enrollments,
    assessments,
    visits,
    assignments,
    programs,
    surveys,
  ] = await Promise.all([
    prisma.farms.count({ where: { owner_id: userId, ...ALIVE } }),
    prisma.fields.count({ where: { farms: { owner_id: userId }, ...ALIVE } }),
    prisma.program_enrollments.count({ where: { farmer_id: userId, ...ALIVE } }),
    prisma.field_assessments.count({ where: { author_id: userId } }),
    prisma.field_visits.count({
      where: { OR: [{ farmer_id: userId }, { assessor_id: userId }] },
    }),
    prisma.assessor_assignments.count({
      where: { OR: [{ farmer_id: userId }, { assessor_id: userId }], ...ALIVE },
    }),
    prisma.programs.count({ where: { created_by: userId, ...ALIVE } }),
    prisma.program_admin_survey_templates.count({
      where: { owner_id: userId, ...ALIVE },
    }),
  ]);
  const assessmentTemplates = await prisma.assessment_templates.count({
    where: { owner_id: userId, program_id: null, is_global: false, ...ALIVE },
  });

  return [
    { label: "Programs they run (and everything in them)", count: programs },
    { label: "Surveys they built", count: surveys },
    { label: "Assessment templates they built", count: assessmentTemplates },
    { label: "Farms", count: farms },
    { label: "Fields", count: fields },
    { label: "Program enrollments", count: enrollments },
    { label: "Assessments they submitted", count: assessments },
    { label: "Field visits", count: visits },
    { label: "Assessor assignments", count: assignments },
  ].filter((l) => l.count > 0);
}

export async function deleteUserCascade(userId: string): Promise<boolean> {
  return prisma.$transaction(
    async (tx) => {
      const found = await tx.users.findFirst({
        where: { id: userId, ...ALIVE },
        select: { id: true },
      });
      if (!found) return false;
      const now = new Date();

      // A program administrator's programs go with them - there would be
      // nobody left running them.
      const programs = await tx.programs.findMany({
        where: { created_by: userId, ...ALIVE },
        select: { id: true },
      });
      for (const p of programs) await cascadeProgram(tx, p.id, now);

      // The surveys and contracts they wrote. The shared global ones belong to
      // the platform, not to a person, and stay.
      await tx.program_admin_survey_templates.updateMany({
        where: { owner_id: userId, is_global: false, ...ALIVE },
        data: { ...stamp(now), updated_at: now },
      });
      await tx.program_admin_contract_templates.updateMany({
        where: { owner_id: userId, is_global: false, ...ALIVE },
        data: { ...stamp(now), updated_at: now },
      });
      // Their own assessment templates; the copies inside their programs went with the programs above.
      const ownTemplates = await tx.assessment_templates.findMany({
        where: { owner_id: userId, program_id: null, is_global: false, ...ALIVE },
        select: { id: true },
      });
      await softDeleteTemplates(tx, ownTemplates.map((t) => t.id), now);

      // Their land, and everything recorded on it.
      const farms = await tx.farms.findMany({
        where: { owner_id: userId, ...ALIVE },
        select: { id: true },
      });
      const farmIds = farms.map((f) => f.id);
      if (farmIds.length) {
        const fields = await tx.fields.findMany({
          where: { farm_id: { in: farmIds }, ...ALIVE },
          select: { id: true },
        });
        const fieldIds = fields.map((f) => f.id);
        if (fieldIds.length) {
          await tx.field_soil.updateMany({
            where: { field_id: { in: fieldIds }, ...ALIVE },
            data: { ...stamp(now), updated_at: now },
          });
          await tx.field_documents.updateMany({
            where: { field_id: { in: fieldIds }, ...ALIVE },
            data: stamp(now),
          });
          await tx.assessment_responses.updateMany({
            where: { field_id: { in: fieldIds }, ...ALIVE },
            data: { ...stamp(now), updated_at: now },
          });
          await tx.assessment_records.updateMany({
            where: { field_id: { in: fieldIds }, ...ALIVE },
            data: { ...stamp(now), updated_at: now },
          });
          await tx.assessment_category_evidence.updateMany({
            where: { field_id: { in: fieldIds }, ...ALIVE },
            data: { ...stamp(now), updated_at: now },
          });
          await tx.field_assessments.deleteMany({
            where: { field_id: { in: fieldIds } },
          });
          await tx.fields.updateMany({
            where: { id: { in: fieldIds } },
            data: { ...stamp(now), updated_at: now },
          });
        }
        await tx.farms.updateMany({
          where: { id: { in: farmIds } },
          data: { ...stamp(now), updated_at: now },
        });
      }

      const enrollments = await tx.program_enrollments.findMany({
        where: { farmer_id: userId, ...ALIVE },
        select: { id: true },
      });
      const enrollmentIds = enrollments.map((e) => e.id);
      if (enrollmentIds.length) {
        await tx.program_enrollment_fields.updateMany({
          where: { enrollment_id: { in: enrollmentIds }, ...ALIVE },
          data: { ...stamp(now), updated_at: now },
        });
        await tx.program_enrollments.updateMany({
          where: { id: { in: enrollmentIds } },
          data: { ...stamp(now), updated_at: now },
        });
      }

      // Whatever they filled in themselves, wherever it was.
      await tx.assessment_responses.updateMany({
        where: { author_id: userId, ...ALIVE },
        data: { ...stamp(now), updated_at: now },
      });
      await tx.assessment_records.updateMany({
        where: { author_id: userId, ...ALIVE },
        data: { ...stamp(now), updated_at: now },
      });
      await tx.assessment_category_evidence.updateMany({
        where: { author_id: userId, ...ALIVE },
        data: { ...stamp(now), updated_at: now },
      });
      await tx.field_assessments.deleteMany({ where: { author_id: userId } });
      await tx.field_visits.deleteMany({
        where: { OR: [{ farmer_id: userId }, { assessor_id: userId }] },
      });
      await tx.assessor_assignments.updateMany({
        where: { OR: [{ farmer_id: userId }, { assessor_id: userId }], ...ALIVE },
        data: { ...stamp(now), updated_at: now },
      });
      // An enrollment keeps its farmer but loses the assessor who left.
      await tx.program_enrollments.updateMany({
        where: { assessor_id: userId, ...ALIVE },
        data: { assessor_id: null, updated_at: now },
      });
      await tx.notifications.updateMany({
        where: { user_id: userId, ...ALIVE },
        data: stamp(now),
      });
      await tx.refresh_tokens.deleteMany({ where: { user_id: userId } });

      await tx.users.updateMany({
        where: { id: userId },
        data: { ...stamp(now), updated_at: now },
      });
      return true;
    },
    TX_LIMITS
  );
}

// ---------------------------------- Surveys --------------------------------

/**
 * Deleting a survey is not the same as taking it off a program.
 *
 * Removing it from a program leaves the survey and what producers already sent
 * in - the program simply has no survey any more. Deleting the survey deletes
 * the questions it asked and the answers given to them, because an answer to a
 * question that no longer exists cannot be read or counted.
 */
export async function summarizeSurveyDeletion(
  templateId: string
): Promise<DeletionLine[]> {
  const [categories, questions, links] = await Promise.all([
    prisma.program_admin_survey_categories.count({
      where: { template_id: templateId, ...ALIVE },
    }),
    prisma.program_admin_survey_questions.count({
      where: { template_id: templateId, ...ALIVE },
    }),
    prisma.program_admin_surveys.findMany({
      where: { template_id: templateId, ...ALIVE },
      select: { id: true, program: { select: { name: true } } },
    }),
  ]);
  const submissions = links.length
    ? await prisma.program_admin_survey_submissions.count({
        where: { survey_id: { in: links.map((l) => l.id) }, ...ALIVE },
      })
    : 0;
  const onPrograms = links.filter((l) => l.program).length;

  return [
    { label: "Categories", count: categories },
    { label: "Questions", count: questions },
    { label: "Programs that use it (they lose their survey)", count: onPrograms },
    { label: "Submissions and their contracts", count: submissions },
  ].filter((l) => l.count > 0);
}

async function cascadeSurvey(
  tx: Tx,
  templateId: string,
  now: Date
): Promise<void> {
  const links = await tx.program_admin_surveys.findMany({
    where: { template_id: templateId, ...ALIVE },
    select: { id: true },
  });
  const linkIds = links.map((l) => l.id);
  if (linkIds.length) {
    const submissions = await tx.program_admin_survey_submissions.findMany({
      where: { survey_id: { in: linkIds }, ...ALIVE },
      select: { id: true },
    });
    const submissionIds = submissions.map((s) => s.id);
    if (submissionIds.length) {
      await tx.program_admin_survey_contracts.deleteMany({
        where: { submission_id: { in: submissionIds } },
      });
      await tx.program_admin_survey_submissions.updateMany({
        where: { id: { in: submissionIds } },
        data: { ...stamp(now), updated_at: now },
      });
    }
    await tx.program_admin_surveys.updateMany({
      where: { id: { in: linkIds } },
      data: { ...stamp(now), updated_at: now },
    });
  }

  await tx.program_admin_survey_questions.updateMany({
    where: { template_id: templateId, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  await tx.program_admin_survey_categories.updateMany({
    where: { template_id: templateId, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  // Score bands carry no deleted_at, so they go for real.
  await tx.program_admin_survey_scoring_rules.deleteMany({
    where: { template_id: templateId },
  });
  await tx.program_admin_survey_templates.updateMany({
    where: { id: templateId, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
}

export async function deleteSurveyCascade(templateId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const found = await tx.program_admin_survey_templates.findFirst({
      where: { id: templateId, ...ALIVE },
      select: { id: true },
    });
    if (!found) return false;
    await cascadeSurvey(tx, templateId, new Date());
    return true;
  }, TX_LIMITS);
}

// ------------------------------ Farms and fields ----------------------------

async function cascadeFields(
  tx: Tx,
  fieldIds: string[],
  now: Date
): Promise<void> {
  if (!fieldIds.length) return;
  await tx.field_soil.updateMany({
    where: { field_id: { in: fieldIds }, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  await tx.field_documents.updateMany({
    where: { field_id: { in: fieldIds }, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  await tx.assessment_responses.updateMany({
    where: { field_id: { in: fieldIds }, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  await tx.assessment_records.updateMany({
    where: { field_id: { in: fieldIds }, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  await tx.assessment_category_evidence.updateMany({
    where: { field_id: { in: fieldIds }, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });

  // Monitoring records and their attachments belong to the field, so they go
  // with it rather than being left behind unreachable.
  const where = { field_id: { in: fieldIds }, ...ALIVE };
  const data = { ...stamp(now), updated_at: now };
  await tx.field_trainings.updateMany({ where, data });
  await tx.field_soil_samples.updateMany({ where, data });
  await tx.field_irrigations.updateMany({ where, data });
  await tx.field_pesticides.updateMany({ where, data });
  await tx.field_fertilizers.updateMany({ where, data });
  await tx.field_tillage_records.updateMany({ where, data });
  await tx.field_amendments.updateMany({ where, data });
  await tx.field_crop_records.updateMany({ where, data });
  await tx.field_nutrient_events.updateMany({ where, data });
  await tx.field_module_documents.updateMany({ where, data });

  // A field enrolled in a program stops being enrolled, and its assessments
  // and visits go: both count towards a program's progress.
  await tx.program_enrollment_fields.updateMany({
    where: { field_id: { in: fieldIds }, ...ALIVE },
    data: { ...stamp(now), updated_at: now },
  });
  await tx.field_assessments.deleteMany({
    where: { field_id: { in: fieldIds } },
  });
  await tx.field_visits.deleteMany({ where: { field_id: { in: fieldIds } } });
  await tx.fields.updateMany({
    where: { id: { in: fieldIds } },
    data: { ...stamp(now), updated_at: now },
  });
  await dropEmptyEnrollments(tx, now);
}

/**
 * An enrollment is a farmer's fields in a program. Once its last field is
 * gone there is nothing enrolled, so the enrollment goes too - otherwise the
 * program keeps counting a farmer who has nothing in it.
 */
async function dropEmptyEnrollments(tx: Tx, now: Date): Promise<void> {
  const empty = await tx.program_enrollments.findMany({
    where: {
      ...ALIVE,
      program_enrollment_fields: { none: { ...ALIVE } },
    },
    select: { id: true },
  });
  if (!empty.length) return;
  await tx.program_enrollments.updateMany({
    where: { id: { in: empty.map((e) => e.id) } },
    data: { ...stamp(now), updated_at: now },
  });
}

async function summarizeFields(fieldIds: string[]): Promise<DeletionLine[]> {
  if (!fieldIds.length) return [];
  const [assessments, enrolled, soil, documents] = await Promise.all([
    prisma.field_assessments.count({ where: { field_id: { in: fieldIds } } }),
    prisma.program_enrollment_fields.count({
      where: { field_id: { in: fieldIds }, ...ALIVE },
    }),
    prisma.field_soil.count({ where: { field_id: { in: fieldIds }, ...ALIVE } }),
    prisma.field_documents.count({
      where: { field_id: { in: fieldIds }, ...ALIVE },
    }),
  ]);
  return [
    { label: "Assessments", count: assessments },
    { label: "Program enrollments of these fields", count: enrolled },
    { label: "Soil records", count: soil },
    { label: "Documents", count: documents },
  ];
}

export async function summarizeFarmDeletion(
  farmId: string
): Promise<DeletionLine[]> {
  const fields = await prisma.fields.findMany({
    where: { farm_id: farmId, ...ALIVE },
    select: { id: true },
  });
  const lines = await summarizeFields(fields.map((f) => f.id));
  return [{ label: "Fields", count: fields.length }, ...lines].filter(
    (l) => l.count > 0
  );
}

export async function deleteFarmCascade(farmId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const found = await tx.farms.findFirst({
      where: { id: farmId, ...ALIVE },
      select: { id: true },
    });
    if (!found) return false;
    const now = new Date();
    const fields = await tx.fields.findMany({
      where: { farm_id: farmId, ...ALIVE },
      select: { id: true },
    });
    await cascadeFields(tx, fields.map((f) => f.id), now);
    await tx.farms.updateMany({
      where: { id: farmId },
      data: { ...stamp(now), updated_at: now },
    });
    return true;
  }, TX_LIMITS);
}

export async function summarizeFieldDeletion(
  fieldId: string
): Promise<DeletionLine[]> {
  return (await summarizeFields([fieldId])).filter((l) => l.count > 0);
}

export async function deleteFieldCascade(fieldId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const found = await tx.fields.findFirst({
      where: { id: fieldId, ...ALIVE },
      select: { id: true },
    });
    if (!found) return false;
    await cascadeFields(tx, [fieldId], new Date());
    return true;
  }, TX_LIMITS);
}

// ------------------------------- Submissions -------------------------------

/** A submission's contracts. They exist only for it, and carry a live link. */
export async function deleteContractsForSubmission(
  submissionId: string
): Promise<void> {
  await prisma.program_admin_survey_contracts.deleteMany({
    where: { submission_id: submissionId },
  });
}
