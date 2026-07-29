import mongoose from "mongoose";
import {
  USER_ROLES,
  ACCOUNT_STATUS,
  ACCOUNT_STATUSES,
} from "../constants/userConstants.js";

const userSchema = new mongoose.Schema(

  {
    
    // BASIC INFO
    

    // TENANT
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      // Not indexed on its own: the compound index below leads with
      // organizationId, so its prefix already serves org-scoped queries.
    },

    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 60,
    },

    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
    },

    // Optional: Google-only accounts have no password. Password accounts still
    // set it (the register validator requires one on that path).
    password: {
      type: String,
    },

    // Set for accounts that sign in with Google; absent otherwise.
    googleId: {
      type: String,
    },


    // ROLE


    role: {
      type: String,
      enum: USER_ROLES,
      required: true,
    },

    // ACCOUNT LIFECYCLE
    // Students are Active on creation; faculty start Pending until a coordinator
    // approves them. Rejected and Suspended are coordinator-set states.
    accountStatus: {
      type: String,
      enum: ACCOUNT_STATUSES,
      default: ACCOUNT_STATUS.ACTIVE,
      // Not indexed on its own (only four values, always queried with org +
      // role): the compound index below covers it.
    },

    // A verifiable signal (e.g. employee id) a coordinator can check when
    // deciding whether a faculty registration is genuine.
    employeeId: {
      type: String,
      trim: true,
      default: "",
    },

    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    approvedAt: {
      type: Date,
      default: null,
    },

    rejectionReason: {
      type: String,
      trim: true,
      default: "",
    },

    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: true,
    },


    // STUDENT FIELDS

    branch: {
      type: String,
      trim: true,
      default: "",
    },

    year: {
      type: Number,
      min: 1,
      max: 4,
    },

    // Student society / club involvement.
    society: {
      name: { type: String, trim: true, default: "" },
      position: { type: String, trim: true, default: "" },
    },

    // A couple of notable student projects.
    projects: {
      type: [
        {
          title: { type: String, trim: true, maxlength: 120 },
          description: { type: String, trim: true, maxlength: 500 },
        },
      ],
      default: [],
    },


    // FACULTY FIELDS


    // Title prefix for faculty (e.g. Dr.) — not every faculty holds a doctorate.
    prefix: {
      type: String,
      enum: ["", "Dr.", "Prof."],
      default: "",
    },

    department: {
      type: String,
      trim: true,
      default: "",
    },

    office: {
      type: String,
      trim: true,
      default: "",
      maxlength: 120,
    },

    interests: {
      type: String,
      trim: true,
      default: "",
    },

    
    // FUTURE PROFILE FEATURES
    

    bio: {
      type: String,
      trim: true,
      default: "",
      maxlength: 1000,
    },

    profileImage: {
      type: String,
      default: "",
    },

    skills: {
      type: [String],
      default: [],
    },

    researchDomains: {
      type: [String],
      default: [],
    },

    linkedinUrl: {
      type: String,
      trim: true,
      default: "",
    },

    designation: {
      type: String,
      trim: true,
      default: "",
    },

    isProfilePublic: {
      type: Boolean,
      default: true,
    },

    
    // ANALYTICS SUPPORT


    applicationsSubmitted: {
      type: Number,
      default: 0,
      min: 0,
    },
  },

  {
    timestamps: true,
  }
);




// INDEXES


// One Google identity maps to one user; sparse so password-only accounts
// (no googleId) are not indexed and do not collide.
userSchema.index({ googleId: 1 }, { unique: true, sparse: true });

// The coordinator's pending-faculty list: one organization's faculty in a given
// account state, newest first. This is the only multi-field user query today.
// Its organizationId prefix also serves any org-scoped user lookup.
userSchema.index({ organizationId: 1, role: 1, accountStatus: 1 });

// NB: single-field indexes on name (text), role, department, branch,
// researchDomains and skills were removed. They existed for a user directory /
// search that is not built; each taxed writes for no read. Reintroduce the
// right index (likely a text or compound one) when that feature lands.



const User = mongoose.model(
  "User",
  userSchema
);

export default User;