const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../config/database');
const { sendEmail } = require('../utils/email');
const router = express.Router();

// Validation rules for registration
const registrationValidation = [
  body('parentName').trim().isLength({ min: 2, max: 100 }).withMessage('Parent name must be between 2-100 characters'),
  body('phone').isMobilePhone().withMessage('Please provide a valid phone number'),
  body('email').optional().isEmail().withMessage('Please provide a valid email address'),
  body('studentName').trim().isLength({ min: 2, max: 100 }).withMessage('Student name must be between 2-100 characters'),
  body('studentAge').isInt({ min: 3, max: 30 }).withMessage('Student age must be between 3-30 years'),
  body('section').isIn(['Nursery', 'Primary', 'Islamiyya', 'Tahfiz', 'Higher Islamic', 'Mosque/Majlis']).withMessage('Please select a valid section'),
  body('paymentPlan').isIn(['Termly Plan', 'Annual Plan']).withMessage('Please select a valid payment plan'),
  body('comments').optional().isLength({ max: 500 }).withMessage('Comments must not exceed 500 characters')
];

// Register a new student
router.post('/', registrationValidation, async (req, res) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const {
      parentName,
      phone,
      email,
      studentName,
      studentAge,
      section,
      paymentPlan,
      comments
    } = req.body;

    // Check if student already exists
    const existingStudent = await db.get(
      'SELECT id FROM students WHERE student_name = ? AND parent_name = ? AND phone = ?',
      [studentName, parentName, phone]
    );

    if (existingStudent) {
      return res.status(409).json({
        success: false,
        message: 'A student with this information is already registered'
      });
    }

    // Get section information for capacity check
    const sectionInfo = await db.get(
      'SELECT * FROM sections WHERE name = ? AND is_active = 1',
      [section]
    );

    if (!sectionInfo) {
      return res.status(400).json({
        success: false,
        message: 'Selected section is not available'
      });
    }

    // Check capacity
    if (sectionInfo.current_enrollment >= sectionInfo.capacity) {
      return res.status(400).json({
        success: false,
        message: 'Selected section is at full capacity'
      });
    }

    // Insert new student registration
    const result = await db.run(
      `INSERT INTO students (student_name, student_age, parent_name, phone, email, section, payment_plan, comments)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [studentName, studentAge, parentName, phone, email, section, paymentPlan, comments]
    );

    // Update section enrollment count
    await db.run(
      'UPDATE sections SET current_enrollment = current_enrollment + 1 WHERE name = ?',
      [section]
    );

    // Send confirmation email if email provided
    if (email) {
      try {
        await sendEmail({
          to: email,
          subject: 'Registration Confirmation - Musab Bin Umair Memorial School',
          html: `
            <h2>Registration Confirmation</h2>
            <p>Dear ${parentName},</p>
            <p>Thank you for registering ${studentName} at Musab Bin Umair Memorial School.</p>
            <h3>Registration Details:</h3>
            <ul>
              <li><strong>Student:</strong> ${studentName}</li>
              <li><strong>Age:</strong> ${studentAge} years</li>
              <li><strong>Section:</strong> ${section}</li>
              <li><strong>Payment Plan:</strong> ${paymentPlan}</li>
              <li><strong>Registration ID:</strong> MBU${result.id.toString().padStart(6, '0')}</li>
            </ul>
            <p>We will contact you soon with further instructions regarding payment and enrollment.</p>
            <p>May Allah bless your child's educational journey with us.</p>
            <p><strong>Musab Bin Umair Memorial School</strong><br>
            Phone: ${process.env.SCHOOL_PHONE}<br>
            Email: ${process.env.SCHOOL_EMAIL}</p>
          `
        });
      } catch (emailError) {
        console.error('Failed to send confirmation email:', emailError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        registrationId: `MBU${result.id.toString().padStart(6, '0')}`,
        studentId: result.id,
        section: section,
        paymentPlan: paymentPlan
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Registration failed. Please try again.'
    });
  }
});

// Get all registrations (admin only)
router.get('/', async (req, res) => {
  try {
    const { status, section, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT * FROM students WHERE 1=1';
    let params = [];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    if (section) {
      query += ' AND section = ?';
      params.push(section);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const students = await db.all(query, params);

    // Get total count for pagination
    let countQuery = 'SELECT COUNT(*) as total FROM students WHERE 1=1';
    let countParams = [];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    if (section) {
      countQuery += ' AND section = ?';
      countParams.push(section);
    }

    const { total } = await db.get(countQuery, countParams);

    res.json({
      success: true,
      data: students,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('Error fetching registrations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registrations'
    });
  }
});

// Get single registration by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const student = await db.get('SELECT * FROM students WHERE id = ?', [id]);

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    res.json({
      success: true,
      data: student
    });

  } catch (error) {
    console.error('Error fetching registration:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch registration'
    });
  }
});

// Update registration status
router.patch('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['pending', 'approved', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be pending, approved, or rejected'
      });
    }

    const result = await db.run(
      'UPDATE students SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: 'Registration not found'
      });
    }

    res.json({
      success: true,
      message: 'Registration status updated successfully'
    });

  } catch (error) {
    console.error('Error updating registration status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update registration status'
    });
  }
});

module.exports = router;