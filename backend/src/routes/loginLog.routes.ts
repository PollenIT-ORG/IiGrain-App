import { Router } from "express";
import { getLoginLogs } from "../controllers/loginLog.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";

const router = Router();

router.get("/", authenticate, authorize("super_admin", "admin"), getLoginLogs);

export default router;
