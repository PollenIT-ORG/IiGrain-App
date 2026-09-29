// Sample messages for the Contact enquiries screen, so the panel can be checked
// with something in it. This is throwaway data, not content: it is deliberately
// NOT part of the DB_SEED run, so a seeded boot never invents enquiries.
//
// Add them:
//   npx tsx src/db/seedContactEnquiries.ts
// Take them away again:
//   npx tsx src/db/seedContactEnquiries.ts --clear
//
// Rows go in through Prisma rather than the API, so no notification is raised
// and no email is sent. Running it twice adds nothing the second time.
//
// The set covers what the screen has to handle: unread and read, a missing
// phone number, a long subject, a long message, and a spread of dates so the
// newest-first order and the Sent column are visible.
import prisma from "./prisma.js";
import logger from "../utils/logger.js";

interface SeedEnquiry {
  name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  isRead: boolean;
  /** How long ago it arrived, in hours. */
  hoursAgo: number;
}

const ENQUIRIES: SeedEnquiry[] = [
  {
    name: "Ramesh Patel",
    email: "ramesh.patel@sampledata.test",
    phone: "+919876500101",
    subject: "Account deactivated, cannot sign in",
    message:
      "I tried to sign in this morning and it says my account is deactivated. I have not changed anything. My last visit was two weeks ago and everything worked then. Could you switch it back on please.",
    isRead: false,
    hoursAgo: 2,
  },
  {
    name: "Sunita Deshmukh",
    email: "sunita.d@sampledata.test",
    phone: null,
    subject: "Enrollment ID not accepted",
    message:
      "The ID from my acceptance email is IIG-2026-004417 but the app keeps saying it is not found. I have typed it several times. Please check whether it is against a different email address.",
    isRead: false,
    hoursAgo: 6,
  },
  {
    name: "Gurpreet Singh",
    email: "gurpreet.singh@sampledata.test",
    phone: "+919876500102",
    subject: "Field area error when adding a new plot",
    message:
      "I am trying to add a fourth field to my farm and it says only 0 acres can be added. The farm is 40 acres and my three fields add up to about 31, so there should be room. Am I reading it wrong?",
    isRead: false,
    hoursAgo: 20,
  },
  {
    name: "Anita Rao",
    email: "anita.rao@sampledata.test",
    phone: "+919876500103",
    subject: "Photos will not attach to my assessment",
    message:
      "Every time I try to add a photo to question 4 the app spins and then nothing happens. The photo is from my phone camera. I am on Android.",
    isRead: false,
    hoursAgo: 30,
  },
  {
    name: "Mohammed Iqbal",
    email: "m.iqbal@sampledata.test",
    phone: "+919876500104",
    subject:
      "Question about the soil sample records and how often they need to be entered through the season",
    message:
      "I want to check how often you expect soil samples to be recorded. My assessor mentioned once before sowing and once after harvest but the app lets me add more. Should I be adding one every time I take a reading, or only the two that count?",
    isRead: false,
    hoursAgo: 48,
  },
  {
    name: "Lakshmi Narayanan",
    email: "lakshmi.n@sampledata.test",
    phone: null,
    subject: "Verification code never arrives",
    message:
      "I have requested the code four times and none of them have come through. I checked spam. The address on the account is this one.",
    isRead: true,
    hoursAgo: 72,
  },
  {
    name: "Harjit Kaur",
    email: "harjit.kaur@sampledata.test",
    phone: "+919876500105",
    subject: "Assessor visit did not show in the app",
    message:
      "My assessor came on Tuesday and did the walk round with me, but the visit is not showing anywhere in the app and my assessment still says not started. He said he had submitted it from his side. Could you check what happened, because I do not want to fill it in twice and end up with two records for the same field. The field is the one on the north side, about nine acres, wheat this season.",
    isRead: true,
    hoursAgo: 96,
  },
  {
    name: "Vikram Chauhan",
    email: "vikram.c@sampledata.test",
    phone: "+919876500106",
    subject: "Boundary keeps disappearing",
    message:
      "I drew the boundary for two of my fields last week and today one of them is blank again. The other one is still there. I redrew it and it saved, but I want to know if something is wrong.",
    isRead: true,
    hoursAgo: 150,
  },
  {
    name: "Priya Menon",
    email: "priya.menon@sampledata.test",
    phone: "+919876500107",
    subject: "Change the email on my account",
    message:
      "I no longer use the address my account was set up with. Can you move it to this one, or do I need to register again with my Enrollment ID?",
    isRead: true,
    hoursAgo: 200,
  },
  {
    name: "Dev Sharma",
    email: "dev.sharma@sampledata.test",
    phone: null,
    subject: "Thanks",
    message:
      "Nothing wrong, just wanted to say the new monitoring screens are much easier to use than before. The training records used to give me duplicates every time and that has stopped.",
    isRead: true,
    hoursAgo: 260,
  },
];

/** So --clear removes exactly what this script put in and nothing else. */
const SEEDED_EMAILS = ENQUIRIES.map((e) => e.email);

export async function seedContactEnquiries(): Promise<{
  created: number;
  skipped: number;
}> {
  const now = Date.now();
  let created = 0;
  let skipped = 0;

  for (const e of ENQUIRIES) {
    const existing = await prisma.contact_enquiries.findFirst({
      where: { email: e.email, subject: e.subject },
      select: { id: true },
    });
    if (existing) {
      skipped += 1;
      continue;
    }
    const at = new Date(now - e.hoursAgo * 60 * 60 * 1000);
    await prisma.contact_enquiries.create({
      data: {
        name: e.name,
        email: e.email,
        phone: e.phone,
        subject: e.subject,
        message: e.message,
        is_read: e.isRead,
        created_at: at,
        updated_at: at,
      },
    });
    created += 1;
  }

  return { created, skipped };
}

/** Removes the sample rows outright. Anything a real person sent is untouched. */
export async function clearContactEnquiries(): Promise<number> {
  const { count } = await prisma.contact_enquiries.deleteMany({
    where: { email: { in: SEEDED_EMAILS } },
  });
  return count;
}

const invokedDirectly = process.argv[1]
  ?.replace(/\\/g, "/")
  .endsWith("db/seedContactEnquiries.ts");

if (invokedDirectly) {
  const clearing = process.argv.includes("--clear");
  const run = clearing
    ? clearContactEnquiries().then((removed) =>
        logger.info(`Sample enquiries removed: ${removed}.`)
      )
    : seedContactEnquiries().then(({ created, skipped }) =>
        logger.info(
          `Sample enquiries seeded: ${created} added, ${skipped} already there.`
        )
      );

  run
    .then(() => prisma.$disconnect())
    .then(() => process.exit(0))
    .catch((err) => {
      logger.error("Seeding the sample enquiries failed", err);
      process.exit(1);
    });
}
