import { Router } from "express";
import {
  submitEnquiry,
  listEnquiries,
  getEnquiry,
  setEnquiryRead,
  setEnquiryResolved,
  bulkDeleteEnquiries,
  deleteEnquiry,
  replyToEnquiry,
  previewEnquiryReply,
} from "../controllers/contactEnquiry.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import { contactLimiter } from "../middlewares/rateLimiters.js";
import {
  createContactEnquirySchema,
  listContactEnquiriesQuerySchema,
  setEnquiryReadSchema,
  setEnquiryResolvedSchema,
  bulkDeleteEnquiriesSchema,
  replyToEnquirySchema,
} from "../validators/contactEnquiry.schema.js";
import { idParamSchema } from "../validators/common.schema.js";

const router = Router();
const withId = validate(idParamSchema, "params");

// Public on purpose: somebody whose account was switched off cannot sign in,
// and reporting that is exactly what this form is for. The limiter is what
// keeps it from being used to send bulk mail.
router.post("/", contactLimiter, validate(createContactEnquirySchema), submitEnquiry);

// A program administrator answers producers day to day, so they read these too.
const enquiryReaders = [
  authenticate,
  authorize("super_admin", "admin", "program_administrator"),
];
// Clearing the unread flag by hand and removing a message stay with the
// platform team, so one person tidying up cannot hide another's work.
const enquiryAdmins = [authenticate, authorize("super_admin", "admin")];

router.get("/", ...enquiryReaders, validate(listContactEnquiriesQuerySchema, "query"), listEnquiries);
// Ahead of "/:id" so "bulk-delete" is not read as an id.
router.post("/bulk-delete", ...enquiryAdmins, validate(bulkDeleteEnquiriesSchema), bulkDeleteEnquiries);
router.get("/:id", ...enquiryReaders, withId, getEnquiry);
router.patch("/:id/read", ...enquiryAdmins, withId, validate(setEnquiryReadSchema), setEnquiryRead);
// Marking work done is part of answering it, so a program administrator may too.
router.patch("/:id/resolve", ...enquiryReaders, withId, validate(setEnquiryResolvedSchema), setEnquiryResolved);
// Writing to a producer in the platform's name stays with the platform team,
// as does seeing that message before it goes.
router.post("/:id/reply", ...enquiryAdmins, withId, validate(replyToEnquirySchema), replyToEnquiry);
router.post("/:id/reply/preview", ...enquiryAdmins, withId, validate(replyToEnquirySchema), previewEnquiryReply);
router.delete("/:id", ...enquiryAdmins, withId, deleteEnquiry);

export default router;
