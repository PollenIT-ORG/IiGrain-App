import { Router } from "express";
import { authenticate } from "../middlewares/authenticate.js";
import { validate } from "../middlewares/validate.js";
import {
  listNotificationsQuerySchema,
  notificationIdParamSchema,
} from "../validators/notification.schema.js";
import {
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
} from "../controllers/notification.controller.js";

const router = Router();

router.use(authenticate);

router.get("/unread-count", unreadCount);
router.patch("/read-all", markAllRead);
router.get("/", validate(listNotificationsQuerySchema, "query"), listNotifications);
router.patch(
  "/:id/read",
  validate(notificationIdParamSchema, "params"),
  markRead
);

export default router;
