import mongoose from "mongoose";

const opportunitySchema = new mongoose.Schema(
  {
    // =========================
    // BASIC INFO
    // =========================

    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 5,
      maxlength: 120,
    },

    description: {
      type: String,
      required: true,
      trim: true,
      minlength: 20,
      maxlength: 3000,
    },

    category: {
      type: String,
      enum: [
        "Internship",
        "Research",
        "Paid Gig",
        "Faculty Project",
      ],
      required: true,
    },

    // =========================
    // POSTED BY
    // =========================

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // =========================
    // ELIGIBILITY
    // =========================

    eligibleBranches: {
      type: [String],
      default: ["All"],
    },

    eligibleYears: {
      type: [String],
      default: ["All"],
    },

    eligibleGender: {
      type: String,
      enum: ["Male", "Female", "Any"],
      default: "Any",
    },

    // =========================
    // CONTACT
    // =========================

    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    // =========================
    // TAGS
    // =========================

    tags: {
      type: [String],
      default: [],
    },

    // =========================
    // DEADLINE
    // =========================

    deadline: {
      type: Date,
      required: true,
    },

    // =========================
    // STATUS
    // =========================

    status: {
      type: String,
      enum: ["Active", "Closed", "Expired"],
      default: "Active",
    },

    // =========================
    // ANALYTICS
    // =========================

    applicationsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    viewsCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    savesCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    // =========================
    // FUTURE FEATURES
    // =========================

    isRemote: {
      type: Boolean,
      default: false,
    },

    location: {
      type: String,
      trim: true,
      default: "",
    },

    stipend: {
      type: String,
      trim: true,
      default: "",
    },

    skillsRequired: {
      type: [String],
      default: [],
    },
  },

  {
    timestamps: true,
  }
);



// =========================
// 🔍 INDEXES
// =========================

// Full text search
opportunitySchema.index({
  title: "text",
  description: "text",
  tags: "text",
});

// Filtering indexes
opportunitySchema.index({ category: 1 });

opportunitySchema.index({ status: 1 });

opportunitySchema.index({ deadline: 1 });

opportunitySchema.index({ postedBy: 1 });

// Multi-field optimized querying
opportunitySchema.index({
  category: 1,
  status: 1,
  deadline: 1,
});

// Recommendation/filter optimization
opportunitySchema.index({
  eligibleBranches: 1,
  eligibleYears: 1,
});

// Trending / sorting
opportunitySchema.index({
  applicationsCount: -1,
  viewsCount: -1,
});



export default mongoose.model(
  "Opportunity",
  opportunitySchema
);