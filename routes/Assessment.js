import express from 'express';
import Assessment from '../models/Assessment.js';
import Patient from '../models/Patient.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// ============================================
// GET ALL ASSESSMENTS FOR A SPECIFIC PATIENT
// ============================================
router.get('/:id/assessments', protect, async (req, res) => {
  try {
    const patientId = req.params.id;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    const assessments = await Assessment.find({ patient: patientId })
      .populate('patient', 'name age headacheType severity')
      .sort({ submittedAt: -1 });

    res.status(200).json({
      success: true,
      count: assessments.length,
      data: assessments
    });

  } catch (error) {
    console.error("Fetch Assessments Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// GET SINGLE ASSESSMENT BY ID
// ============================================
router.get('/assessments/:assessmentId', protect, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId)
      .populate('patient', 'name age headacheType severity');

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    res.status(200).json({
      success: true,
      data: assessment
    });

  } catch (error) {
    console.error("Fetch Assessment Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ============================================
// CREATE NEW ASSESSMENT
// ============================================
router.post('/:id/assessments', protect, async (req, res) => {
 try {
    // ✅ PARSE THE STRINGIFIED ASSESSMENT DATA FROM FORMDATA
    const assessmentData = typeof req.body.assessment === 'string' 
      ? JSON.parse(req.body.assessment) 
      : req.body;

    console.log("=== BACKEND RECEIVED ===");
    console.log("Patient ID:", req.params.id);
    console.log("req.user:", req.user);
    console.log("Diagnosis Match:", assessmentData.diagnosisMatch);
    console.log("Diagnosis Issue:", assessmentData.diagnosisIssue);
    console.log("Remarks:", assessmentData.remarks);
    console.log("========================");

    // ✅ VALIDATE PATIENT EXISTS
    const patient = await Patient.findById(req.params.id);
    if (!patient) {
      return res.status(404).json({
        success: false,
        message: 'Patient not found'
      });
    }

    // ✅ VALIDATE USER IS AUTHENTICATED
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // ✅ EXTRACT USER ID (handles both ObjectId and string formats)
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    const userEmail = req.user.email || assessmentData.doctorEmail;
    const userRole = req.user.role || 'doctor';

    if (!userEmail) {
      return res.status(400).json({
        success: false,
        message: 'User email is required'
      });
    }

    // ✅ CREATE ASSESSMENT
    const assessmentDoc = await Assessment.create({
      patient: req.params.id,
      
      createdBy: {
        id: userId,              // ✅ String format (backward compatible)
        email: userEmail,
        role: userRole
      },
      
      assessmentFlow: assessmentData.assessments?.flow ?? [],  // ✅ Handles mixed types

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

    // ✅ RETURN WITH POPULATED PATIENT DATA
    const populatedAssessment = await Assessment.findById(assessmentDoc._id)
      .populate('patient', 'name age headacheType severity');

    res.status(201).json({
      success: true,
      data: populatedAssessment,
    });

  } catch (error) {
    console.error("Assessment Save Error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// ============================================
// DELETE ASSESSMENT
// ============================================
router.delete('/assessments/:assessmentId', protect, async (req, res) => {
  try {
    const assessment = await Assessment.findById(req.params.assessmentId);

    if (!assessment) {
      return res.status(404).json({
        success: false,
        message: 'Assessment not found'
      });
    }

    // ✅ Check authorization (handles both string and ObjectId)
    const userId = req.user._id ? req.user._id.toString() : req.user.id;
    
    if (assessment.createdBy.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this assessment'
      });
    }

    await assessment.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Assessment deleted successfully'
    });

  } catch (error) {
    console.error("Delete Assessment Error:", error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;