
/**
 * @file Policy.js
 * @description Defines policy content, source links, view/like totals, and embedded citizen vote/comment records.
 * @module Models/Policy
 * @requires mongoose
 */
const mongoose = require("mongoose");
const { Schema } = mongoose;

// Embedded engagement records intentionally keep votes/comments beside their policy for atomic updates and reads.
const PolicySchema = new Schema(
  {
    // String, required and trimmed; no per-field index is declared.
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // String, required; categories are not constrained to a fixed enum.
    category: {
      type: String,
      required: true,
    },
    // String, required and trimmed; stores the policy summary/description.
    summary: {
      type: String,
      required: true,
      trim: true,
    },
    // String, optional via empty-string default and trimmed; URL validation occurs in the publishing controller.
    documentUrl: {
      type: String,
      default: "",
      trim: true,
    },
    // String, optional legacy URL alias; empty by default and not indexed.
    pdfUrl: {
      type: String,
      default: "",
    },
    // String, optional lifecycle label with an empty-string default.
    status: {
      type: String,
      default: "",
    },
    // Number, defaults to zero; aggregate count is updated by vote handling.
    totalVotes: {
      type: Number,
      default: 0,
    },
    // Number, defaults to zero; incremented when a policy detail view is loaded.
    viewCount: {
      type: Number,
      default: 0,
    },
    // ObjectId references to User documents; array defaults to empty and stores policy likes.
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    // Date defaulted to now; schema timestamps also provide createdAt/updatedAt.
    createdAt: {
       type: Date,
        default: Date.now,
          },
    // Embedded policy engagement object; vote counters and comments have no separate collection/index.
    interactions: {
      // Vote tallies and voter IDs for each supported stance.
      votes: {
        agree: {
          // Number default 0; aggregate count for agree votes.
          count: {
            type: Number,
            default: 0,
          },
          // String IDs, default empty; tracks voters to enforce one vote per policy.
          voters: [
            {
              type: String,
            },
          ],
        },
        neutral: {
          // Number default 0; aggregate count for neutral votes.
          count: {
            type: Number,
            default: 0,
          },
          // String IDs, default empty; tracks voters to enforce one vote per policy.
          voters: [
            {
              type: String,

            },
          ],
        },
        disagree: {
          // Number default 0; aggregate count for disagree votes.
          count: {
            type: Number,
            default: 0,
          },
          // String IDs, default empty; tracks voters to enforce one vote per policy.
          voters: [
            {
              type:String,
            },
          ],
        },
      },
      comments: [
        {
          // String Firebase UID, required; not a Mongoose ref.
          user: {
            type: String,

            required: true,
          },
          // String, required and trimmed; comment text.
          text: {
            type: String,
            required: true,
            trim: true,
          },
          // Date defaulted to now for each embedded comment.
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
    },
  },
  {
    // Mongoose automatically manages createdAt and updatedAt; no explicit index is declared.
    timestamps: true,
  }
);

const policyModel = mongoose.model("policyModel", PolicySchema, "policies");
module.exports = policyModel;
