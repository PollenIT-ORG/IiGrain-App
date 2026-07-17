import pool, { checkConnection } from "./pool.js";
import logger from "../utils/logger.js";

(async () => {
  try {
    const result = await checkConnection();
    logger.info("Database is reachable", result);
    process.exit(0);
  } catch (err) {
    logger.error("Could not reach the database", err);
    process.exit(1);
  } finally {
    await pool.end();
  }
})();
