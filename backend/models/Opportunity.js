import mongoose from "mongoose";

const opportunitySchema = new mongoose.Schema(
  {
    
    // BASIC INFO
    

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

    
    // POSTED BY
    

    postedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    
    // ELIGIBILITY
    

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

    
    // CONTACT
    

    contactEmail: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },

    
    // TAGS
    

    tags: {
      type: [String],
      default: [],
    },

    
    // DEADLINE
    

    deadline: {
      type: Date,
      required: true,
    },

    
    // STATUS
    

    // Active   → live, visible in the public feed, accepting applications
    // Archived → paused while the faculty reviews applicants; reversible
    // Closed   → finalised (e.g. position filled); terminal
    // Expired  → derived in the UI when an Active deadline has passed
    status: {
      type: String,
      enum: ["Active", "Archived", "Closed", "Expired"],
      default: "Active",
    },

    
    // ANALYTICS
    

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

    
    // FUTURE FEATURES
    

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


    // SOFT DELETE

    isDeleted: {
      type: Boolean,
      default: false,
    },

    deletedAt: {
      type: Date,
      default: null,
    },


    // PDF ATTACHMENTS

    attachments: {
      type: [
        {
          originalName: { type: String, required: true },
          filename: { type: String, required: true },
          url: { type: String, required: true },
          uploadedAt: { type: Date, default: Date.now },
        },
      ],
      default: [],
    },


    // DEADLINE EXTENSION HISTORY

    deadlineHistory: {
      type: [
        {
          previousDeadline: { type: Date, required: true },
          extendedAt: { type: Date, default: Date.now },
          reason: { type: String, default: "" },
        },
      ],
      default: [],
    },
  },

  {
    timestamps: true,
  }
);




// INDEXES


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

// NB: eligibleBranches and eligibleYears are both arrays, and MongoDB cannot
// build a compound index spanning two array fields ("parallel arrays"). Such an
// index silently fails to build in a warm dev DB but breaks the very first
// insert on a clean database. Eligibility filtering is done client-side today;
// if it moves server-side, index each array field on its own, not together.

// Trending / sorting
opportunitySchema.index({
  applicationsCount: -1,
  viewsCount: -1,
});



export default mongoose.model(
  "Opportunity",
  opportunitySchema
);