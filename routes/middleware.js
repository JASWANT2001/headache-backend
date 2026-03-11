import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

export const auth = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    
    req.userId = decoded.userId;
    req.role = decoded.role;
    
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid token' });
  }
};
