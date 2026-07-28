import User from "../models/User.js";
import { ACCOUNT_STATUS } from "../constants/userConstants.js";

// Blocks any request whose account is not currently Active, checking the
// database rather than the token. The token is long-lived and carries no
// status, so a freshly suspended or not-yet-approved account would otherwise
// keep access until the token expired. Use on state-changing routes.
const requireActiveAccount = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).select("accountStatus");
    if (!user || user.accountStatus !== ACCOUNT_STATUS.ACTIVE) {
      return res
        .status(403)
        .json({ success: false, message: "Your account is not active." });
    }
    next();
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

export default requireActiveAccount;
