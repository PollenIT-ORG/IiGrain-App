// One-off, idempotent seed: copies the current live survey (categories,
// questions, score thresholds) into the Program Admin Survey module as the
// shared "Global" template, and seeds the shared "Global" contract template.
// Program administrators can then use them as-is or copy them into their own.
//
// Run once locally and on production:
//   npx tsx src/db/seedProgramAdminGlobal.ts
//
// Safe to run more than once: it does nothing if a global already exists.
import prisma from "./prisma.js";

// The wording the contract page has always shown, now editable in the panel.
const GLOBAL_CONTRACT = {
  intro:
    "This is the standard program contract. Please read it through before signing. A copy is kept on your file.",
  clauses: [
    {
      heading: "1. The program",
      body: "iiGrain operates a regenerative agriculture program for grain producers. The producer agrees to take part in the program for the land described in their eligibility survey, and to follow the practices agreed with their assessor.",
    },
    {
      heading: "2. Records and assessments",
      body: "The producer agrees to record field data honestly in the mobile app, including soil readings, practices and yields, and to allow an assessor to visit the land at a reasonable time each year to verify those records.",
    },
    {
      heading: "3. Use of data",
      body: "The producer keeps ownership of their farm data. iiGrain may use it to score assessments, produce reports and verify participation in the program.",
    },
    {
      heading: "4. Enrollment",
      body: "On acceptance of this signed contract, iiGrain will issue an Enrollment ID. That ID is personal to the producer and is required the first time they register in the mobile app.",
    },
    {
      heading: "5. Ending participation",
      body: "Either party may end participation with written notice. Records created before that date remain part of the program history.",
    },
  ],
};

/** Seeds the shared global contract template (idempotent). */
export async function seedGlobalContractTemplate(): Promise<{
  created: boolean;
  templateId?: string;
}> {
  // Any contract at all means this has been set up already. Looking only for a
  // global one would bring the starter contract back after a deliberate delete.
  const existing = await prisma.program_admin_contract_templates.findFirst({
    orderBy: [{ is_global: "desc" }, { created_at: "asc" }],
  });
  if (existing) return { created: false, templateId: existing.id };

  const created = await prisma.program_admin_contract_templates.create({
    data: {
      is_global: true,
      name: "Global",
      intro: GLOBAL_CONTRACT.intro,
      clauses: GLOBAL_CONTRACT.clauses,
      is_active: true,
    },
  });
  return { created: true, templateId: created.id };
}

export async function seedProgramAdminGlobalTemplate(): Promise<{
  created: boolean;
  templateId?: string;
  categories?: number;
  questions?: number;
  rules?: number;
}> {
  // As above: one survey of any kind means this has been set up already.
  const existing = await prisma.program_admin_survey_templates.findFirst({
    orderBy: [{ is_global: "desc" }, { created_at: "asc" }],
  });
  if (existing) return { created: false, templateId: existing.id };

  const [srcCategories, srcQuestions, srcRules] = await Promise.all([
    prisma.survey_categories.findMany({
      where: { deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
    prisma.survey_questions.findMany({
      where: { deleted_at: null },
      orderBy: { sort_order: "asc" },
    }),
    prisma.survey_scoring_rules.findMany({ where: { is_active: true } }),
  ]);

  const template = await prisma.program_admin_survey_templates.create({
    data: {
      is_global: true,
      name: "Global",
      description: "The shared master survey. Copied from the current survey.",
      is_active: true,
    },
  });

  // Copy categories, keeping a map from the old id to the new id so questions
  // can be re-pointed to the copied categories.
  const catIdMap = new Map<string, string>();
  for (const c of srcCategories) {
    const created = await prisma.program_admin_survey_categories.create({
      data: {
        template_id: template.id,
        name: c.name,
        description: c.description,
        icon: c.icon,
        sort_order: c.sort_order,
        is_active: c.is_active,
      },
    });
    catIdMap.set(c.id, created.id);
  }

  for (const q of srcQuestions) {
    await prisma.program_admin_survey_questions.create({
      data: {
        template_id: template.id,
        category_id: q.category_id ? catIdMap.get(q.category_id) ?? null : null,
        question_text: q.question_text,
        help_text: q.help_text,
        option_0: q.option_0,
        option_1: q.option_1,
        option_2: q.option_2,
        option_3: q.option_3,
        weight: q.weight,
        sort_order: q.sort_order,
        is_active: q.is_active,
      },
    });
  }

  for (const r of srcRules) {
    await prisma.program_admin_survey_scoring_rules.create({
      data: {
        template_id: template.id,
        category: r.category,
        min_score: r.min_score,
        max_score: r.max_score,
        is_active: r.is_active,
      },
    });
  }

  return {
    created: true,
    templateId: template.id,
    categories: srcCategories.length,
    questions: srcQuestions.length,
    rules: srcRules.length,
  };
}

// Allow running directly with tsx.
const isDirectRun = process.argv[1]?.replace(/\\/g, "/").endsWith("seedProgramAdminGlobal.ts");
if (isDirectRun) {
  seedProgramAdminGlobalTemplate()
    .then(async (res) => {
      // eslint-disable-next-line no-console
      console.log("Program Admin global survey template:", JSON.stringify(res));
      const contract = await seedGlobalContractTemplate();
      // eslint-disable-next-line no-console
      console.log("Program Admin global contract template:", JSON.stringify(contract));
      return prisma.$disconnect();
    })
    .then(() => process.exit(0))
    .catch(async (err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      await prisma.$disconnect();
      process.exit(1);
    });
}
