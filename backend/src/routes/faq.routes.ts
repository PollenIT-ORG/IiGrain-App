import { Router } from "express";
import {
  publicFaqs,
  listFaqs,
  getFaq,
  createFaq,
  updateFaq,
  deleteFaq,
  reorderFaqs,
} from "../controllers/faq.controller.js";
import { authenticate, authorize } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  createFaqSchema,
  updateFaqSchema,
  listFaqsQuerySchema,
  reorderFaqsSchema,
} from "../validators/faq.schema.js";
import { idParamSchema } from "../validators/common.schema.js";

const router = Router();
const withId = validate(idParamSchema, "params");

// The help screen reads this before the user has signed in, and again after, so
// it carries no token. Only live, switched-on entries are returned.
router.get("/", publicFaqs);

// Everything below writes the list, which is the platform team's job.
const faqAdmins = [authenticate, authorize("super_admin", "admin")];

router.get("/manage", ...faqAdmins, validate(listFaqsQuerySchema, "query"), listFaqs);
// Ahead of "/:id" so "reorder" is not read as an id.
router.patch("/reorder", ...faqAdmins, validate(reorderFaqsSchema), reorderFaqs);
router.post("/", ...faqAdmins, validate(createFaqSchema), createFaq);
router.get("/:id", ...faqAdmins, withId, getFaq);
router.patch("/:id", ...faqAdmins, withId, validate(updateFaqSchema), updateFaq);
router.delete("/:id", ...faqAdmins, withId, deleteFaq);

export default router;
