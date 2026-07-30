import express from "express";

import {
  list,
  unreadCount,
  markRead,
  markAllRead,
} from "../controllers/notificationController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateObjectId } from "../utils/validateObjectId.js";

const router = express.Router();

router.get("/", authMiddleware, list);
router.get("/unread-count", authMiddleware, unreadCount);
router.patch("/read-all", authMiddleware, markAllRead);
router.patch("/:id/read", authMiddleware, validateObjectId("id"), markRead);

export default router;
