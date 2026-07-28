import { Router } from "express";
import healthRoutes from "./health.routes.js";
import configRoutes from "./config.routes.js";
import authRoutes from "./auth.routes.js";
import roleRoutes from "./role.routes.js";
import loginLogRoutes from "./loginLog.routes.js";
import userRoutes from "./user.routes.js";
import profileRoutes from "./profile.routes.js";
import organizationRoutes from "./organization.routes.js";
import farmRoutes from "./farm.routes.js";
import fieldRoutes from "./field.routes.js";
import assessmentRoutes from "./assessment.routes.js";
import assessorAssignmentRoutes from "./assessorAssignment.routes.js";
import assessorAssessmentRoutes from "./assessorAssessment.routes.js";
import programRoutes from "./program.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import visitRoutes from "./visit.routes.js";
import notificationRoutes from "./notification.routes.js";
import webRoutes from "./web.routes.js";
import standaloneRoutes from "./standalone.routes.js";
import eligibilityAdminRoutes from "./eligibilityAdmin.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/config", configRoutes);
router.use("/auth", authRoutes);
router.use("/roles", roleRoutes);
router.use("/login-logs", loginLogRoutes);
router.use("/users", userRoutes);
router.use("/profile", profileRoutes);
router.use("/organizations", organizationRoutes);
router.use("/farms", farmRoutes);
router.use("/fields", fieldRoutes);
router.use("/assessments", assessmentRoutes);
router.use("/assessor-assignments", assessorAssignmentRoutes);
router.use("/assessor", assessorAssessmentRoutes);
router.use("/programs", programRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/visits", visitRoutes);
router.use("/notifications", notificationRoutes);

// Public website (eligibility survey, contract signing, contact form).
router.use("/web", webRoutes);
// The standalone survey flow (single page, magic-link tracking, no account).
router.use("/standalone", standaloneRoutes);
// Admin portal screens for that flow.
router.use("/eligibility", eligibilityAdminRoutes);

export default router;
