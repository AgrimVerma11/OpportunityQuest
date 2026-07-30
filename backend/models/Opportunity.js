import mongoose from "mongoose";
import { OPPORTUNITY_CATEGORIES } from "../constants/opportunityConstants.js";

const opportunitySchema = new mongoose.Schema(
  {
    
    // BASIC INFO
    

    // TENANT
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      // Not indexed on its own: the compound feed index below leads with
      // organizationId, so its prefix already serves org-scoped queries.
    },

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
      enum: OPPORTUNITY_CATEGORIES,
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
          // Storage key for deletion; url is the browser-facing address.
          key: { type: String },
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
//
// Right-sized to the queries the repository actually runs. The schema
// previously carried a full-text index and several single-field / non-org-led
// indexes (category, status, deadline, applicationsCount, category+status+
// deadline) for filtering and "trending" features that do not exist — every one
// taxed writes for no read, and none could serve the org-scoped feed. They were
// removed. Reintroduce an index next to the query that needs it.

// The feed: active, in-date opportunities for one organization, optionally
// filtered by category/branch/year and searched by title. Leads with
// organizationId so its prefix also serves the per-org category-stats
// aggregate. The equality on status and range on deadline are index-bounded;
// the small org-scoped result is then sorted by createdAt in memory.
opportunitySchema.index({ organizationId: 1, status: 1, deadline: 1 });

// A faculty member's own postings ("my opportunities").
opportunitySchema.index({ postedBy: 1 });

// NB: eligibleBranches and eligibleYears are both arrays, and MongoDB cannot
// build a compound index spanning two array fields ("parallel arrays") — it
// breaks the first insert on a clean database. The feed does filter on them
// ($in), but only within the already-narrow org+status+deadline result, so the
// scan is cheap. If either ever needs its own index, index the fields
// separately, never together.

// NB: title/description/tags search uses an escaped regex (partial, as-you-type
// matching), not $text — so there is intentionally no text index here.



export default mongoose.model(
  "Opportunity",
  opportunitySchema
);