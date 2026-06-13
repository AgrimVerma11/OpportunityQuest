import express from "express";

import { getPublicProfile } from "../controllers/userController.js";
import authMiddleware from "../middleware/authMiddleware.js";
import { validateObjectId } from "../utils/validateObjectId.js";

const router = express.Router();

// Any authenticated user can view another user's public profile.
router.get("/:id", authMiddleware, validateObjectId("id"), getPublicProfile);

export default router;
