import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema(
  {
    patientId: { type: String, unique: true, required: true },

    // 🔹 Patient info
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true },

    // 🔹 NEW FIELDS
    specialty: { type: String, required: true }, // Text input (e.g., "Cardiology")
    type: { type: String, required: true }, // "Self" or "Assisted"
    language: { type: String, required: true },
    qualification: { type: String, required: true },

    remarks: { type: String, default: '' },

    // ✅ PATIENT IMAGE (NEW - OPTIONAL)
    patientImage: { type: String, default: null },

    // 🔹 Who created this patient
    createdBy: {
      type: String,
      required: true,
    },

    // 🔹 Linked assessments
    assessments: [
      { type: mongoose.Schema.Types.ObjectId, ref: 'Assessment' }
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Patient', patientSchema);