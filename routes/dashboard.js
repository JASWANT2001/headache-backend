import express from 'express';
import User from '../models/User.js';
import Patient from '../models/Patient.js';
import Assessment from '../models/Assessment.js';
import { auth } from './middleware.js';

const router = express.Router();

/* ==============================
   GET ADMIN DASHBOARD STATS
================================= */
router.get('/stats', auth, async (req, res) => {
  try {
    // Only admin can access dashboard stats
    if (req.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin only.'
      });
    }

    // 1️⃣ TOTAL USERS (Doctors only)
    const totalUsers = await User.countDocuments({ role: 'doctor' });

    // 2️⃣ TOTAL PATIENTS
    const totalPatients = await Patient.countDocuments();

    // 3️⃣ TOTAL ASSESSMENTS
    const totalAssessments = await Assessment.countDocuments();

    // 4️⃣ ACTIVE PROVIDERS (created patients in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const activeProviderIds = await Patient.distinct('createdBy', {
      createdAt: { $gte: sevenDaysAgo }
    });
    const activeProviders = activeProviderIds.length;

    // 5️⃣ AVERAGE PATIENTS PER USER
    const avgPatientsPerUser = totalUsers > 0 
      ? (totalPatients / totalUsers).toFixed(1) 
      : 0;

    // 6️⃣ TOP PERFORMING PROVIDERS
 const topProviders = await Patient.aggregate([
  {
    $group: {
      _id: '$createdBy',         // this is a String
      patientsCreated: { $count: {} },
      lastPatientDate: { $max: '$createdAt' }
    }
  },
  {
    $addFields: {
      createdByObjectId: {
        $convert: {
          input: '$_id',
          to: 'objectId',
          onError: null,          // "admin-001" strings will become null
          onNull: null
        }
      }
    }
  },
  {
    $lookup: {
      from: 'users',
      localField: 'createdByObjectId',   // now matches users._id
      foreignField: '_id',
      as: 'doctorInfo'
    }
  },
  {
    $project: {
      _id: 1,
      providerName: {
        $cond: {
          if: { $gt: [{ $size: '$doctorInfo' }, 0] },
          then: { $arrayElemAt: ['$doctorInfo.username', 0] },
          else: 'Admin'          // fallback for admin-001 or unknown
        }
      },
      email: {
        $cond: {
          if: { $gt: [{ $size: '$doctorInfo' }, 0] },
          then: { $arrayElemAt: ['$doctorInfo.email', 0] },
          else: 'admin@system'
        }
      },
      patientsCreated: 1,
      lastPatientDate: 1,
      isActiveToday: {
        $gte: [
          '$lastPatientDate',
          new Date(new Date().setHours(0, 0, 0, 0))
        ]
      },
      isActiveThisWeek: {
        $gte: ['$lastPatientDate', sevenDaysAgo]
      }
    }
  },
  {
    $sort: { patientsCreated: -1 }
  },
  {
    $limit: 10
  }
]);

    // Format last active status
    const formattedTopProviders = topProviders.map(provider => {
      const lastDate = new Date(provider.lastPatientDate);
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      let lastActive;
      if (provider.isActiveToday) {
        lastActive = 'Today';
      } else if (lastDate.toDateString() === yesterday.toDateString()) {
        lastActive = 'Yesterday';
      } else {
        const daysAgo = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
        lastActive = `${daysAgo} days ago`;
      }

      return {
        _id: provider._id,
        providerName: provider.providerName,
        email: provider.email,
        patientsCreated: provider.patientsCreated,
        status: provider.isActiveThisWeek ? 'Active' : 'Inactive',
        lastActive
      };
    });

    // 7️⃣ RECENT ACTIVITY (last 5 patients created)
    const recentPatients = await Patient.find()
      .populate('createdBy', 'username email')
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name patientId createdAt createdBy');

    // 📊 SEND RESPONSE
    res.status(200).json({
      success: true,
      data: {
        overview: {
          totalUsers,
          totalPatients,
          totalAssessments,
          activeProviders,
          avgPatientsPerUser: parseFloat(avgPatientsPerUser)
        },
        topProviders: formattedTopProviders,
        recentPatients
      }
    });

  } catch (error) {
    console.error('Dashboard Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching dashboard stats'
    });
  }
});

/* ==============================
   GET DOCTOR-SPECIFIC STATS
================================= */
router.get('/doctor-stats', auth, async (req, res) => {
  try {
    if (req.role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'This endpoint is for doctors only'
      });
    }

    // My total patients
    const myPatients = await Patient.countDocuments({ createdBy: req.userId });

    // My total assessments
    const myAssessments = await Assessment.countDocuments({ doctorId: req.userId });

    // My patients this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const patientsThisMonth = await Patient.countDocuments({
      createdBy: req.userId,
      createdAt: { $gte: startOfMonth }
    });

    // My assessments this month
    const assessmentsThisMonth = await Assessment.countDocuments({
      doctorId: req.userId,
      createdAt: { $gte: startOfMonth }
    });

    res.status(200).json({
      success: true,
      data: {
        myPatients,
        myAssessments,
        patientsThisMonth,
        assessmentsThisMonth
      }
    });

  } catch (error) {
    console.error('Doctor Stats Error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;