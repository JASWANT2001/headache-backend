import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  userId: { type: String, unique: true, required: true },
  username: { type: String, unique: true, required: true, trim: true },
  email: { type: String, unique: true, required: true, lowercase: true },
  phoneNumber: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['doctor', 'specialist'], default: 'doctor' },
  location: { type: String, default: '' },
  district: { type: String, default: '' },
  instituteName: { type: String, default: '' },
  instituteType: { type: String, default: '' },

  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  lastLogin: { type: Date, default: null },
}, {
  timestamps: true,
  toJSON: { virtuals: true },  // ✅ ADD THIS
  toObject: { virtuals: true }  // ✅ ADD THIS
});

// ✅ ADD THIS VIRTUAL FIELD
userSchema.virtual('numberOfPatients', {
  ref: 'Patient',
  localField: '_id',
  foreignField: 'createdBy',
  count: true
});

// Hash password before saving
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare passwords
userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

// Don't return password
userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  return obj;
};

export default mongoose.model('User', userSchema);