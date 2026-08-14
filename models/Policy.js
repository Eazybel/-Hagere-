
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
    },
    createdAt: {
       type: Date,
        default: Date.now,
          },
    interactions: {
      votes: {
        agree: {
          count: {
            type: Number,
            default: 0,
          },
          voters: [
            {
              type: String,
            },
          ],
        },
        neutral: {
          count: {
            type: Number,
            default: 0,
          },
          voters: [
            {
              type: String,

            },
          ],
        },
        disagree: {
          count: {
            type: Number,
            default: 0,
          },
          voters: [
            {
              type:String,
            },
          ],
        },
      },
      comments: [
        {
          user: {
            type: String,

            required: true,
          },
          text: {
            type: String,
            required: true,
            trim: true,
          },
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
  },
  {
    timestamps: true,
  }
);

const policyModel = mongoose.model("policyModel", PolicySchema, "policies");
module.exports = policyModel;
