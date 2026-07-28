import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
  deleteNotificationsSchema,
} from "../validators/notification.schema.js";
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
  deleteOne,
  deleteMany,
  deleteAll,
} from "../controllers/notification.controller.js";

const router = Router();

router.use(authenticate);

router.get("/unread-count", unreadCount);
router.patch("/read-all", markAllRead);
router.get("/", validate(listNotificationsQuerySchema, "query"), listNotifications);
// Bulk actions - defined before "/:id" so they are not captured as an id.
router.post("/delete", validate(deleteNotificationsSchema), deleteMany);
router.delete("/", deleteAll);
router.patch(
  "/:id/read",
  validate(notificationIdParamSchema, "params"),
  markRead
);
router.delete(
  "/:id",
  validate(notificationIdParamSchema, "params"),
  deleteOne
);

export default router;
