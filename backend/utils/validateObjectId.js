import mongoose from "mongoose";

// Guards a route param that must be a Mongo ObjectId, so malformed input
// returns a clean 400 instead of surfacing a cast error as a 500.
export const validateObjectId =
  (param = "id") =>
  (req, res, next) => {
    if (!mongoose.Types.ObjectId.isValid(req.params[param])) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid identifier" });
    }
    next();
  };

export default validateObjectId;
