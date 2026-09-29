// Starter questions for the Help screen in the mobile app.
//
// Runs with the rest of the seed:
//   DB_SEED=true npm run dev
// or on its own:
//   npx tsx src/db/seedFaqs.ts
//
// Safe to run more than once. A question already in the table is left alone,
// wording and all, so an edit made in the panel is never overwritten. A FAQ
// that was deleted stays deleted rather than coming back on the next run.
import prisma from "./prisma.js";
import logger from "../utils/logger.js";

interface SeedFaq {
  question: string;
  answer: string;
}

// Order here is the order farmers see. Sign-up and sign-in trouble first,
// because that is what someone opens Help for.
const FAQS: SeedFaq[] = [
  {
    question: "What is an Enrollment ID and where do I get one?",
    answer:
      "An Enrollment ID looks like IIG-2026-123456. It is issued once your contract is accepted, and it is emailed to the address you used on the eligibility survey.\n\nYou need it the first time you register in the app. If you cannot find the email, check your spam folder before getting in touch.",
  },
  {
    question: "Why do I need an Enrollment ID to register?",
    answer:
      "The ID is how the app knows which producer you are and which program you belong to. It also fills in your name and email for you, so there is nothing to type wrong.\n\nRegistration in the app is for farmers only. Assessors do not register: an administrator creates the account and the assessor signs in with it.",
  },
  {
    question: "My Enrollment ID is not being accepted.",
    answer:
      "Check the ID against the email it came in. It is not case sensitive and spaces are ignored, but every digit has to match.\n\nIf it still will not go through, the ID may belong to a different email address than the one you are using. Send us a message from Contact Us and we will look it up.",
  },
  {
    question: "It says my account is deactivated. What do I do?",
    answer:
      "An administrator has switched the account off, so signing in is blocked until it is switched back on.\n\nUse the Contact Us button on that message. Tell us the email address on the account and we will get back to you. You do not need to be signed in to send that message.",
  },
  {
    question: "I did not get my verification code.",
    answer:
      "The code is six digits and is valid for ten minutes. It goes to the email address on your account.\n\nCheck your spam folder first. If it is not there, request a new one from the same screen. Each new code replaces the last, so use the most recent email.",
  },
  {
    question: "I forgot my password.",
    answer:
      "Tap Forgot password on the sign-in screen and enter your email. We send a code to that address, and once you enter it you can set a new password.\n\nA password needs at least 8 characters and has to contain both a letter and a number. Changing your password signs you out on your other devices.",
  },
  {
    question: "How do I add a farm?",
    answer:
      "Open Farms and tap Add Farm. You need a name and the total area in acres. Location, business entity and the map pin are optional and can be filled in later.\n\nThe area you enter here is the ceiling for the fields inside it, so put in the real total.",
  },
  {
    question: "How do I add a field to my farm?",
    answer:
      "Open the farm, then tap Add Field. Give the field a name and its area in acres. Crop, season, irrigation and the sowing and harvest dates are optional.\n\nTwo fields on the same farm cannot share a name, which keeps them apart in reports.",
  },
  {
    question: "Why can I not save my field area?",
    answer:
      'If you see "Field area is too large", the fields on that farm would add up to more than the farm itself.\n\nThe message tells you how many acres are still free. Either lower this field, or open the farm and correct its total area first.',
  },
  {
    question: "How do I draw the boundary of a field?",
    answer:
      "Open the field and tap the map. Place a point at each corner of the field and the app joins them up. You need at least three points, and the shape must not cross over itself.\n\nThe app works out the area from the shape you draw, so you can use it to check the acres you entered. Tap a point to remove it, or drag it to move it.",
  },
  {
    question: "What is a program and how does my field join one?",
    answer:
      "A program is the scheme you were accepted into. Your fields are enrolled in it so their records and assessments count towards it.\n\nEnrollment is done for you when your contract is accepted. If a field is missing from a program, send us a message and we will add it.",
  },
  {
    question: "What do the assessment scores mean?",
    answer:
      "Every question is scored from 0 to 3, where 0 means the practice is not in place and 3 means it is fully in place. Your percentage is the total you scored out of the highest you could have scored.\n\nYou can answer in any order and come back later. Nothing is final until you tap Submit.",
  },
  {
    question: "Can I add photos to an assessment answer?",
    answer:
      "Yes. Each answer takes up to five files. Photos can be up to 5 MB each, and a video up to 50 MB.\n\nJPG, PNG, WEBP and HEIC images are accepted, along with MP4, MOV and WEBM video. Photos help your assessor confirm what you have recorded.",
  },
  {
    question: "What are the monitoring records for?",
    answer:
      "They are the running record of what you actually did on a field: training attended, soil samples taken, irrigation, fertiliser, pesticide, tillage, amendments, crops and nutrient events.\n\nFill them in through the season rather than all at once. Your assessor reads them on a visit, and they are what your program reporting is built from.",
  },
  {
    question: "What files can I attach to a field?",
    answer:
      "PDFs, images and Word documents, up to 10 MB each. Lab reports, certificates and receipts are the usual ones.\n\nIf a file is refused, the message tells you the size limit for that particular upload.",
  },
  {
    question: "What happens during an assessor visit?",
    answer:
      "An assessor is assigned to your farm and visits to check the field against what you recorded. The app shows you when a visit starts and when they arrive.\n\nThey fill in their own copy of the assessment. You can see both side by side once it is submitted.",
  },
  {
    question: "How do I change my password or update my details?",
    answer:
      "Open your profile. You can change your name, your phone number and your password there.\n\nYour email address cannot be changed from the app, because it is what your Enrollment ID and your account are tied to. Send us a message if it needs to change.",
  },
  {
    question: "How do I get help with something not listed here?",
    answer:
      "Use Contact Us on this screen. Tell us your name, the email address on your account, a short subject and what is going wrong.\n\nThe more detail you give, the faster we can sort it out. We reply by email to the address you send from.",
  },
];

/** Adds any question that is not in the table yet. Existing rows are untouched. */
export async function seedFaqs(): Promise<{ created: number; skipped: number }> {
  let created = 0;
  let skipped = 0;

  // One past the highest live entry, so seeded rows land under anything the
  // panel has already added rather than pushing it down.
  const last = await prisma.faqs.findFirst({
    where: { deleted_at: null },
    orderBy: { sort_order: "desc" },
    select: { sort_order: true },
  });
  let order = (last?.sort_order ?? -1) + 1;

  for (const faq of FAQS) {
    // Deleted rows count as present: a FAQ removed on purpose must not return.
    const existing = await prisma.faqs.findFirst({
      where: { question: faq.question },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    await prisma.faqs.create({
      data: {
        question: faq.question,
        answer: faq.answer,
        sort_order: order,
        is_active: true,
      },
    });
    order += 1;
    created += 1;
  }

  return { created, skipped };
}

// Allows `npx tsx src/db/seedFaqs.ts` without going through a server boot.
const runDirectly = process.argv[1]?.replace(/\\/g, "/").endsWith("db/seedFaqs.ts");
if (runDirectly) {
  seedFaqs()
    .then(({ created, skipped }) => {
      logger.info(`FAQs seeded: ${created} added, ${skipped} already there.`);
      return prisma.$disconnect();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Seeding the FAQs failed", err);
      process.exit(1);
    });
}
