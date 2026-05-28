import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
  },

  password: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["Student", "Faculty"],
    required: true,
  },

  gender: {
    type: String,
    enum: ["Male", "Female", "Other"],
    required: true,
  },

  // 🎓 STUDENT FIELDS
branch: { type: String },
year: { type: Number },
department: { type: String },
interests: { type: String },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model("User", userSchema);

export default User;