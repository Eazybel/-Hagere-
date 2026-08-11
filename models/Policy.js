const mongoose = require("mongoose");
const { Schema } = mongoose;

const PolicySchema = new Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      enum: [
        "Urban Planning & Infrastructure",
        "Fiscal Policy & Commerce",
        "Technology & Telecommunications",
        "Public Health & Welfare",
      ],
    },
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    pdfUrl: {
      type: String,
      default: "",
    },
    status: {
      type: String,
      enum: ["active", "closed", "draft"],
      default: "active",
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "userModel",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const policyModel = mongoose.model("policyModel", PolicySchema, "policies");
module.exports = policyModel;