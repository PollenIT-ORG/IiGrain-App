import prisma from "../db/prisma.js";

/** The submission a survey status link belongs to, or null when the link is not valid. */
export async function findSubmissionByStatusToken(
  token: string
): Promise<{ id: string } | null> {
  return prisma.eligibility_submissions.findFirst({
    where: { status_token: token, deleted_at: null },
    select: { id: true },
  });
}
