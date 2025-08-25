const express = require('express');
const db = require('../config/database');
const router = express.Router();

// Get all sections with enrollment information
router.get('/', async (req, res) => {
  try {
    const sections = await db.all(`
      SELECT 
        s.*,
        COUNT(st.id) as enrolled_students,
        (s.capacity - s.current_enrollment) as available_spots
      FROM sections s
      LEFT JOIN students st ON s.name = st.section AND st.status = 'approved'
      WHERE s.is_active = 1
      GROUP BY s.id
      ORDER BY s.name
    `);

    res.json({
      success: true,
      data: sections
    });

  } catch (error) {
    console.error('Error fetching sections:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch sections'
    });
  }
});

// Get single section by name or ID
router.get('/:identifier', async (req, res) => {
  try {
    const { identifier } = req.params;
    
    // Check if identifier is numeric (ID) or string (name)
    const isId = /^\d+$/.test(identifier);
    const query = isId 
      ? 'SELECT * FROM sections WHERE id = ? AND is_active = 1'
      : 'SELECT * FROM sections WHERE name = ? AND is_active = 1';

    const section = await db.get(query, [identifier]);

    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    // Get enrolled students count
    const enrollmentData = await db.get(`
      SELECT 
        COUNT(*) as enrolled_students,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_students,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_students
      FROM students 
      WHERE section = ?
    `, [section.name]);

    res.json({
      success: true,
      data: {
        ...section,
        ...enrollmentData,
        available_spots: section.capacity - (enrollmentData.approved_students || 0)
      }
    });

  } catch (error) {
    console.error('Error fetching section:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch section'
    });
  }
});

// Get students in a specific section
router.get('/:sectionName/students', async (req, res) => {
  try {
    const { sectionName } = req.params;
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    // Verify section exists
    const section = await db.get('SELECT * FROM sections WHERE name = ?', [sectionName]);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    let query = 'SELECT * FROM students WHERE section = ?';
    let params = [sectionName];

    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const students = await db.all(query, params);

    // Get total count
    let countQuery = 'SELECT COUNT(*) as total FROM students WHERE section = ?';
    let countParams = [sectionName];

    if (status) {
      countQuery += ' AND status = ?';
      countParams.push(status);
    }

    const { total } = await db.get(countQuery, countParams);

    res.json({
      success: true,
      data: {
        section: section,
        students: students,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: total,
          pages: Math.ceil(total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Error fetching section students:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch section students'
    });
  }
});

// Get section statistics
router.get('/:sectionName/stats', async (req, res) => {
  try {
    const { sectionName } = req.params;

    // Verify section exists
    const section = await db.get('SELECT * FROM sections WHERE name = ?', [sectionName]);
    if (!section) {
      return res.status(404).json({
        success: false,
        message: 'Section not found'
      });
    }

    // Get comprehensive statistics
    const stats = await db.get(`
      SELECT 
        COUNT(*) as total_registrations,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_registrations,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_registrations,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_registrations,
        COUNT(CASE WHEN payment_plan = 'Annual Plan' THEN 1 END) as annual_payments,
        COUNT(CASE WHEN payment_plan = 'Termly Plan' THEN 1 END) as termly_payments,
        AVG(student_age) as average_age,
        MIN(student_age) as youngest_student,
        MAX(student_age) as oldest_student
      FROM students 
      WHERE section = ?
    `, [sectionName]);

    // Get monthly registration trends (last 6 months)
    const monthlyTrends = await db.all(`
      SELECT 
        strftime('%Y-%m', created_at) as month,
        COUNT(*) as registrations
      FROM students 
      WHERE section = ? 
        AND created_at >= date('now', '-6 months')
      GROUP BY strftime('%Y-%m', created_at)
      ORDER BY month DESC
    `, [sectionName]);

    res.json({
      success: true,
      data: {
        section: section,
        statistics: {
          ...stats,
          capacity_utilization: ((stats.approved_registrations / section.capacity) * 100).toFixed(1),
          available_spots: section.capacity - stats.approved_registrations
        },
        monthly_trends: monthlyTrends
      }
    });

  } catch (error) {
    console.error('Error fetching section statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch section statistics'
    });
  }
});

module.exports = router;