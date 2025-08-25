const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const router = express.Router();

// Admin login
router.post('/login', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { username, password } = req.body;

    // Find admin user
    const admin = await db.get(
      'SELECT * FROM admin_users WHERE username = ? OR email = ?',
      [username, username]
    );

    if (!admin) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    await db.run(
      'UPDATE admin_users SET last_login = CURRENT_TIMESTAMP WHERE id = ?',
      [admin.id]
    );

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: admin.id, 
        username: admin.username, 
        role: admin.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          email: admin.email,
          role: admin.role,
          last_login: admin.last_login
        }
      }
    });

  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Login failed'
    });
  }
});

// Get dashboard statistics
router.get('/dashboard', authenticateToken, async (req, res) => {
  try {
    // Get overall statistics
    const totalStudents = await db.get('SELECT COUNT(*) as count FROM students');
    const pendingRegistrations = await db.get('SELECT COUNT(*) as count FROM students WHERE status = "pending"');
    const approvedRegistrations = await db.get('SELECT COUNT(*) as count FROM students WHERE status = "approved"');
    const unreadMessages = await db.get('SELECT COUNT(*) as count FROM contact_messages WHERE status = "unread"');

    // Get section-wise enrollment
    const sectionStats = await db.all(`
      SELECT 
        s.name,
        s.capacity,
        COUNT(st.id) as enrolled,
        s.capacity - COUNT(st.id) as available
      FROM sections s
      LEFT JOIN students st ON s.name = st.section AND st.status = 'approved'
      WHERE s.is_active = 1
      GROUP BY s.id
      ORDER BY s.name
    `);

    // Get recent registrations
    const recentRegistrations = await db.all(`
      SELECT student_name, section, status, created_at
      FROM students
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Get recent messages
    const recentMessages = await db.all(`
      SELECT name, subject, status, created_at
      FROM contact_messages
      ORDER BY created_at DESC
      LIMIT 5
    `);

    // Get monthly registration trends (last 6 months)
    const monthlyTrends = await db.all(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as registrations
      FROM students 
      WHERE created_at >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
    `);

    // Get payment plan distribution
    const paymentStats = await db.all(`
      SELECT 
        payment_plan,
        COUNT(*) as count
      FROM students
      GROUP BY payment_plan
    `);

    res.json({
      success: true,
      data: {
        overview: {
          total_students: totalStudents.count,
          pending_registrations: pendingRegistrations.count,
          approved_registrations: approvedRegistrations.count,
          unread_messages: unreadMessages.count
        },
        section_stats: sectionStats,
        recent_registrations: recentRegistrations,
        recent_messages: recentMessages,
        monthly_trends: monthlyTrends,
        payment_stats: paymentStats
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard data'
    });
  }
});

// Get admin profile
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const admin = await db.get(
      'SELECT id, username, email, role, last_login, created_at FROM admin_users WHERE id = ?',
      [req.user.id]
    );

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    res.json({
      success: true,
      data: admin
    });

  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Update admin profile
router.put('/profile', authenticateToken, [
  body('email').optional().isEmail().withMessage('Please provide a valid email'),
  body('currentPassword').optional().isLength({ min: 6 }).withMessage('Current password must be at least 6 characters'),
  body('newPassword').optional().isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { email, currentPassword, newPassword } = req.body;
    const adminId = req.user.id;

    // Get current admin data
    const admin = await db.get('SELECT * FROM admin_users WHERE id = ?', [adminId]);
    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin not found'
      });
    }

    let updateFields = [];
    let updateValues = [];

    // Update email if provided
    if (email && email !== admin.email) {
      // Check if email already exists
      const existingAdmin = await db.get(
        'SELECT id FROM admin_users WHERE email = ? AND id != ?',
        [email, adminId]
      );
      
      if (existingAdmin) {
        return res.status(409).json({
          success: false,
          message: 'Email already in use'
        });
      }

      updateFields.push('email = ?');
      updateValues.push(email);
    }

    // Update password if provided
    if (currentPassword && newPassword) {
      const isValidPassword = await bcrypt.compare(currentPassword, admin.password_hash);
      if (!isValidPassword) {
        return res.status(400).json({
          success: false,
          message: 'Current password is incorrect'
        });
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      updateFields.push('password_hash = ?');
      updateValues.push(hashedNewPassword);
    }

    if (updateFields.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid fields to update'
      });
    }

    // Add updated_at timestamp
    updateFields.push('updated_at = CURRENT_TIMESTAMP');
    updateValues.push(adminId);

    // Update admin record
    await db.run(
      `UPDATE admin_users SET ${updateFields.join(', ')} WHERE id = ?`,
      updateValues
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
});

// Export data (CSV format)
router.get('/export/:type', authenticateToken, async (req, res) => {
  try {
    const { type } = req.params;
    const { format = 'json' } = req.query;

    let data = [];
    let filename = '';

    switch (type) {
      case 'students':
        data = await db.all('SELECT * FROM students ORDER BY created_at DESC');
        filename = `students_${new Date().toISOString().split('T')[0]}`;
        break;
      
      case 'messages':
        data = await db.all('SELECT * FROM contact_messages ORDER BY created_at DESC');
        filename = `messages_${new Date().toISOString().split('T')[0]}`;
        break;
      
      case 'sections':
        data = await db.all(`
          SELECT 
            s.*,
            COUNT(st.id) as enrolled_students
          FROM sections s
          LEFT JOIN students st ON s.name = st.section AND st.status = 'approved'
          GROUP BY s.id
          ORDER BY s.name
        `);
        filename = `sections_${new Date().toISOString().split('T')[0]}`;
        break;
      
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid export type'
        });
    }

    if (format === 'csv') {
      // Convert to CSV format
      if (data.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'No data to export'
        });
      }

      const headers = Object.keys(data[0]);
      const csvContent = [
        headers.join(','),
        ...data.map(row => 
          headers.map(header => 
            JSON.stringify(row[header] || '')
          ).join(',')
        )
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      res.send(csvContent);
    } else {
      // Return JSON format
      res.json({
        success: true,
        data: data,
        exported_at: new Date().toISOString(),
        total_records: data.length
      });
    }

  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export data'
    });
  }
});

module.exports = router;