import prisma from "./prisma.js";
import logger from "../utils/logger.js";
import { applyClock, describeClock } from "../services/clock.service.js";

/**
 * Applies the timezone chosen in settings and shows what the data already in
 * the database now reads as.
 *
 * Saving the setting in the admin panel does this on its own - this is here
 * for a deploy, or to check the effect from a terminal:
 *
 *   npm run db:clock
 */
(async () => {
  try {
    const applied = await applyClock();
    logger.info(
      `🕒 Settings say ${applied.clock.timezone}, ` +
        `${applied.clock.hour12 ? "12" : "24"} hour clock.`
    );
    logger.info("How the rows already in the database now read:");
    for (const s of applied.samples) {
      logger.info(
        s.rows === 0
          ? `   ${s.table}.${s.column}: no rows yet`
          : `   ${s.table}.${s.column}: ${s.rows} rows, ${s.oldest} to ${s.newest}`
      );
    }
    logger.info(`✅ ${describeClock(applied)}`);
    process.exit(0);
  } catch (err) {
    logger.error("❌ Could not apply the clock to the database", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
})();
