import mongoose from "mongoose";

const assessmentSchema = new mongoose.Schema({
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true
  },

  createdBy: {
    id: {
      type: String,  // ✅ KEEP AS STRING for backward compatibility
      required: true
    },
    email: {
      type: String,
      required: true
    },
    role: {
      type: String,
      enum: ["doctor", "admin"],
      required: true
    }
  },

  assessmentFlow: [
    {
      node: String,
      question: String,
      answer: mongoose.Schema.Types.Mixed  // ✅ ACCEPTS BOTH STRINGS AND ARRAYS
    }
  ],

  diagnosis: {
    title: String,
    message: String,
    severity: String,
  },

  diagnosisMatch: {
    type: Boolean,
    required: true,
    default: false
  },

  diagnosisIssue: {
    type: String,
    default: ""
  },

  remarks: {
    type: String,
    default: ""
  },

  submittedAt: {
    type: Date,
    default: Date.now,
  }
}, {
  timestamps: true
});

export default mongoose.model("Assessment", assessmentSchema);