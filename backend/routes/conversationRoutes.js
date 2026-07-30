import express from "express";

import {
  start,
  list,
  thread,
  send,
} from "../controllers/conversationController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import authorizeRoles from "../middleware/authorizeRoles.js";
import { validateObjectId } from "../utils/validateObjectId.js";

const router = express.Router();

// Faculty-initiated: only a faculty member can open a conversation.
router.post("/", authMiddleware, authorizeRoles("Faculty"), start);

router.get("/", authMiddleware, list);
router.get("/:id", authMiddleware, validateObjectId("id"), thread);
router.post(
  "/:id/messages",
  authMiddleware,
  validateObjectId("id"),
  send
);

export default router;
