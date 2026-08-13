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
      default: "",
    }
  },
  {
    timestamps: true,
  }
);

const policyModel = mongoose.model("policyModel", PolicySchema, "policies");
module.exports = policyModel;