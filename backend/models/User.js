import mongoose from "mongoose";

const userSchema = new mongoose.Schema(

  {
    
    // BASIC INFO
    

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

    password: {
      type: String,
      required: true,
    },


    // ROLE


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

    
    // FACULTY FIELDS
    

    department: {
      type: String,
      trim: true,
      default: "",
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
      maxlength: 500,
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
    

    opportunitiesPosted: {
      type: Number,
      default: 0,
      min: 0,
    },

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


// Search users
userSchema.index({
  name: "text",
});

// Fast filtering
userSchema.index({
  role: 1,
});

userSchema.index({
  department: 1,
});

userSchema.index({
  branch: 1,
});

userSchema.index({
  researchDomains: 1,
});

userSchema.index({
  skills: 1,
});



const User = mongoose.model(
  "User",
  userSchema
);

export default User;