import { Router } from "express";
import healthRoutes from "./health.routes.js";
import configRoutes from "./config.routes.js";
import authRoutes from "./auth.routes.js";
import roleRoutes from "./role.routes.js";
import loginLogRoutes from "./loginLog.routes.js";
import userRoutes from "./user.routes.js";
import profileRoutes from "./profile.routes.js";
import organizationRoutes from "./organization.routes.js";
import emailSettingsRoutes from "./emailSettings.routes.js";
import farmRoutes from "./farm.routes.js";
import fieldRoutes from "./field.routes.js";
import assessmentRoutes from "./assessment.routes.js";
import assessorAssignmentRoutes from "./assessorAssignment.routes.js";
import assessorAssessmentRoutes from "./assessorAssessment.routes.js";
import programRoutes from "./program.routes.js";
import dashboardRoutes from "./dashboard.routes.js";
import visitRoutes from "./visit.routes.js";
import fieldModuleRoutes from "./fieldModule.routes.js";
import notificationRoutes from "./notification.routes.js";
import faqRoutes from "./faq.routes.js";
import contactEnquiryRoutes from "./contactEnquiry.routes.js";
import programAdminSurveyRoutes from "./programAdminSurvey.routes.js";
import programAdminSurveyPublicRoutes from "./programAdminSurveyPublic.routes.js";

const router = Router();

router.use("/health", healthRoutes);
router.use("/config", configRoutes);
router.use("/auth", authRoutes);
router.use("/roles", roleRoutes);
router.use("/login-logs", loginLogRoutes);
router.use("/users", userRoutes);
router.use("/profile", profileRoutes);
router.use("/organizations", organizationRoutes);
router.use("/email-settings", emailSettingsRoutes);
router.use("/farms", farmRoutes);
router.use("/fields", fieldRoutes);
router.use("/assessments", assessmentRoutes);
router.use("/assessor-assignments", assessorAssignmentRoutes);
router.use("/assessor", assessorAssessmentRoutes);
router.use("/programs", programRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/visits", visitRoutes);
router.use("/field-monitoring", fieldModuleRoutes);
router.use("/notifications", notificationRoutes);
// Help screen content and the form that reaches the office. Both have a public
// half, because the app shows them to someone who cannot sign in.
router.use("/faqs", faqRoutes);
router.use("/contact-enquiries", contactEnquiryRoutes);

// Program Admin Survey module - admin portal (scoped) + public survey link.
router.use("/program-admin-surveys", programAdminSurveyRoutes);
router.use("/program-admin-survey", programAdminSurveyPublicRoutes);

export default router;
