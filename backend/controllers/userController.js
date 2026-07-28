import * as userService from "../services/userService.js";
import { respondError } from "../utils/respondError.js";

// GET /api/users/:id — public-safe profile, used to view another user
// (e.g. a student viewing the faculty who posted an opportunity).
export const getPublicProfile = async (req, res) => {
  try {
    const profile = await userService.getPublicProfile(
      req.params.id,
      req.user.organizationId
    );
    res.json({ success: true, profile });
  } catch (error) {
    respondError(res, error);
  }
};
