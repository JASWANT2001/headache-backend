import express from "express";
import crypto from "crypto";
import Patient from "../models/Patient.js";
import Assessment from "../models/Assessment.js";
import { auth } from "./middleware.js";
import upload from "../middlewares/uploads.js";  // ✅ FIXED: Correct path

const router = express.Router();

/* ==============================
   Helper: Generate Patient ID
================================= */
const generatePatientId = () => {
  return `PAT-${Date.now()}-${crypto
    .randomBytes(4)
    .toString("hex")
    .toUpperCase()}`;
};

/* ==============================
   Create Patient
================================= */
router.post("/", auth, async (req, res) => {
  try {
    const { name, age, specialty, type, language, qualification, remarks, patientId } = req.body;

    if (!name || !age || !specialty || !type || !language || !qualification) {
      return res.status(400).json({
        success: false,
        message: "All required fields must be provided",
      });
    }

    // If user provided a custom patientId, check it's not already taken
    if (patientId) {
      const existing = await Patient.findOne({ patientId: patientId.trim() });
      if (existing) {
        return res.status(400).json({
          success: false,
          message: "Patient ID already exists. Please use a different one.",
        });
      }
    }

    const patient = await Patient.create({
      patientId: patientId?.trim() || generatePatientId(),
      name,
      age,
      specialty,
      type,
      language,
      qualification,
      remarks,
      createdBy: req.userId,
    });

    res.status(201).json({ success: true, data: patient });
  } catch (error) {
    console.error("Create Patient Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==============================
   Get My Patients (With Search + Pagination)
================================= */
router.get("/my-patients", auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const search = req.query.search || "";
    const skip = (page - 1) * limit;

    const query = {
      createdBy: req.userId,
      $or: [
        { name: { $regex: search, $options: "i" } },
        { patientId: { $regex: search, $options: "i" } },
      ],
    };

    const patients = await Patient.find(query)
      .populate("assessments")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Patient.countDocuments(query);

    res.status(200).json({
      success: true,
      data: patients,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Fetch My Patients Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==============================
   Get All Patients (Admin Only)
================================= */
router.get("/all", auth, async (req, res) => {
  try {
    if (req.role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Access denied. Admin only.",
      });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const patients = await Patient.find()
      .populate({ path: "assessments" })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Safely populate createdBy only for valid ObjectIds
    const { Types } = await import("mongoose");
    for (const p of patients) {
      if (p.createdBy && Types.ObjectId.isValid(p.createdBy)) {
        const User = (await import("../models/User.js")).default;
        const u = await User.findById(p.createdBy).select("username email").lean();
        p.createdBy = u || { _id: p.createdBy, username: "Admin", email: "" };
      } else {
        p.createdBy = { _id: p.createdBy, username: "Admin", email: "" };
      }
    }

    const total = await Patient.countDocuments();

    res.status(200).json({
      success: true,
      data: patients,
      pagination: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Admin Fetch Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==============================
   Get Assessments for Patient
================================= */
router.get("/:patientId/assessments", auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.patientId,
      createdBy: req.userId,
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found or unauthorized",
      });
    }

    const assessments = await Assessment.find({
      patient: patient._id,
    }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: assessments.length,
      data: assessments,
    });
  } catch (error) {
    console.error("Fetch Assessments Error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

/* ==============================
   Save Assessment for Patient (WITH OPTIONAL IMAGE UPLOAD)
================================= */
router.post("/:patientId/assessments", auth, upload.single("image"), async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.patientId,
      createdBy: req.userId,
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found or unauthorized",
      });
    }

  // ✅ Handle image upload (OPTIONAL)
let imagePath = null;

if (req.file) {
  imagePath = req.file.path; // Cloudinary image URL

  await Patient.findByIdAndUpdate(req.params.patientId, {
    patientImage: imagePath
  });
}

    // ✅ Support BOTH old (JSON) and new (FormData) formats
    let assessmentData;
    let doctorEmail;

    if (req.body.assessment) {
      // NEW FORMAT: FormData with image
      assessmentData = JSON.parse(req.body.assessment);
      doctorEmail = assessmentData.doctorEmail;
    } else {
      // OLD FORMAT: Direct JSON (existing flow - NO DISTURBANCE)
      assessmentData = req.body;
      doctorEmail = req.body.doctorEmail;
    }

    if (!doctorEmail) {
      return res.status(400).json({
        success: false,
        message: "Doctor email is required"
      });
    }
console.log("=== PATIENTS.JS BACKEND DEBUG ===");
    console.log("Diagnosis Match:", assessmentData.diagnosisMatch);
    console.log("Diagnosis Issue:", assessmentData.diagnosisIssue);
    console.log("Remarks:", assessmentData.remarks);
    console.log("================================");
   const assessment = await Assessment.create({
      patient: patient._id,

      // ✅ REQUIRED by schema
      createdBy: {
        id: req.userId,
        email: doctorEmail,
        role: req.role,
      },

      // ✅ Keep existing fields (no disturbance)
      doctorId: req.userId,
      doctorEmail: doctorEmail,

      assessmentFlow: assessmentData.assessments?.flow ?? [],
      diagnosis: {
        title: assessmentData.assessments?.result?.title ?? "",
        message: assessmentData.assessments?.result?.message ?? "",
        severity: assessmentData.assessments?.result?.severity ?? "",
      },

      diagnosisMatch: assessmentData.diagnosisMatch ?? false,
      diagnosisIssue: assessmentData.diagnosisIssue ?? "",
      remarks: assessmentData.remarks ?? "",

      submittedAt: assessmentData.assessments?.completedAt ?? new Date(),
    });

    patient.assessments.push(assessment._id);
    await patient.save();

    res.status(201).json({ 
      success: true, 
      data: assessment,
      image: imagePath  // null if no image uploaded
    });
  } catch (error) {
    console.error("Assessment Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==============================
   Get Single Patient (Secure)
================================= */
router.get("/:patientId", auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.patientId,
      createdBy: req.userId,
    })
      .populate("createdBy", "username email")
      .populate("assessments");

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found or unauthorized",
      });
    }

    res.status(200).json({ success: true, data: patient });
  } catch (error) {
    console.error("Get Patient Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==============================
   Update Patient (Secure)
================================= */
router.put("/:patientId", auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.patientId,
      createdBy: req.userId,
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found or unauthorized",
      });
    }

    Object.assign(patient, req.body);
    await patient.save();

    res.status(200).json({ success: true, data: patient });
  } catch (error) {
    console.error("Update Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ==============================
   Delete Patient (Secure)
================================= */
router.delete("/:patientId", auth, async (req, res) => {
  try {
    const patient = await Patient.findOne({
      _id: req.params.patientId,
      createdBy: req.userId,
    });

    if (!patient) {
      return res.status(404).json({
        success: false,
        message: "Patient not found or unauthorized",
      });
    }

    // 🔥 Delete all related assessments first
    await Assessment.deleteMany({ patient: patient._id });

    // Then delete patient
    await patient.deleteOne();

    res.status(200).json({
      success: true,
      message: "Patient and related assessments deleted successfully",
    });
  } catch (error) {
    console.error("Delete Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;