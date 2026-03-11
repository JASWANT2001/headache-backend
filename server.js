import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { connectDB } from './db.js';

// Import Routes
import authRoutes from './routes/auth.js';
import patientRoutes from './routes/patients.js';
import dashboardRoutes from './routes/dashboard.js'; 

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use("/uploads", express.static("uploads"));  // 👈 ADD THIS LINE

// Connect to MongoDB
connectDB();

// Root Route (Test)
app.get('/', (req, res) => {
  res.json({ message: '✓ Backend is running!', timestamp: new Date().toISOString() });
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/dashboard', dashboardRoutes); // 👈 ADD THIS

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Error Handler
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ success: false, message: err.message });
});

// Start Server
const PORT = process.env.PORT || 5001;
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║  ✓ Backend Server Running                                 ║
║  ✓ Port: ${PORT}                                               ║
║  ✓ URL: http://localhost:${PORT}                          ║
║  ✓ MongoDB: Connected                                      ║
║  ✓ CORS: Enabled for http://localhost:5173               ║
║  ✓ Dashboard API: /api/dashboard/stats                    ║
╚════════════════════════════════════════════════════════════╝
  `);
});