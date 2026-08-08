const mongoose=require("mongoose")
const UserSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    avatar: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["citizen"],
      default: "citizen",
    },
    votesCast: [
      {
        policyId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Policy",
          required: true,
        },
        stance: {
          type: String,
          enum: ["agree", "neutral", "disagree"],
          required: true,
        },
        votedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);
const userModel=mongoose.model("User",UserSchema,"users")
module.exports=userModel