import mongoose from "mongoose";

// A tenant. Every user, opportunity and application belongs to exactly one
// organization, and all data access is scoped to it so institutions never see
// one another's records. A registrant is matched to their organization by the
// domain of their email address.
const organizationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    // Email domains that map a registrant to this organization (e.g.
    // "thapar.edu"). Stored lowercase, without the leading "@".
    emailDomains: {
      type: [String],
      required: true,
      validate: {
        validator: (value) => Array.isArray(value) && value.length > 0,
        message: "An organization needs at least one email domain",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

// Fast lookup of the organization that owns an email domain. Unique so a domain
// cannot be claimed by two organizations.
organizationSchema.index({ emailDomains: 1 }, { unique: true });

export default mongoose.model("Organization", organizationSchema);
