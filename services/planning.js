const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');

// ... your existing middleware and configurations ...

JWT_SECRET = '12345';
// Middleware to authenticate and extract user from JWT
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  console.log("Authorization Header:", authHeader);

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.log("Authorization header missing or invalid");
    return res.status(401).json({ message: 'Authorization token is missing' });
  }

  const token = authHeader.split(' ')[1];
  console.log("Extracted Token:", token);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    console.log("Decoded Token Payload:", decoded);
    req.user = decoded; // This sets req.user with userId and role
    next();
  } catch (error) {
    console.log("JWT Verification Error:", error.message);
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};
// ==================== USER ENDPOINTS ====================

router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;

  try {
    // Check if the user already exists
    const userExists = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    if (userExists.rows.length > 0) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user into the database
    const result = await pool.query(
      'INSERT INTO "User" (email, password, role) VALUES ($1, $2, $3) RETURNING id, email, role',
      [email, hashedPassword, role]
    );

    res.status(201).json({
      message: 'User created successfully',
      user: result.rows[0]
    });
  } catch (err) {
    console.error('Registration Error:', err);
    res.status(500).json({ message: 'Registration failed', error: err.message });
  }
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    // Check if the user exists
    const result = await pool.query('SELECT * FROM "User" WHERE email = $1', [email]);
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Compare the password with the stored hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // Generate a PROPER JWT token (not mock)
    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '72h' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      role: user.role,
      user_id: user.id,
      email: user.email
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Login failed' });
  }
});
// Get users with role = 'member'
router.get('/users/members', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email FROM "User" WHERE role = $1 ORDER BY email ASC',
      ['member']
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching members:', error);
    res.status(500).json({ error: 'Failed to fetch members' });
  }
});
// Get user by ID
router.get('/users/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      'SELECT id, email, role FROM "User" WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch user' });
  }
});





// ==================== PROJECT ENDPOINTS ====================

// Create a new project
router.post('/projects', authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      project_name,
      start_date,
      end_date,
      comment,
      members = [] // array of user IDs from dropdown
    } = req.body;

    const creatorId = req.user.userId;

    await client.query('BEGIN');

    // 1️⃣ Create project (creator stored ONLY here)
    const projectResult = await client.query(
      `
      INSERT INTO projects ("project-name", "start-date", "end-date", comment, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING project_id
      `,
      [project_name, start_date, end_date, comment, creatorId]
    );

    const projectId = projectResult.rows[0].project_id;

    // 2️⃣ Add ONLY selected members
    for (const memberId of members) {
      await client.query(
        `
        INSERT INTO project_members (project_id, user_id, role)
        VALUES ($1, $2, 'member')
        ON CONFLICT (project_id, user_id) DO NOTHING
        `,
        [projectId, memberId]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Project created successfully',
      project_id: projectId
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Failed to create project' });
  } finally {
    client.release();
  }
});


// Get projects for logged-in member
router.get('/api/my-projects', authenticate, async (req, res) => {
  try {
   
    const userId = req.user.userId; // ✅ correct
    const result = await pool.query(`
      SELECT p.*, pm.role
      FROM projects p
      JOIN project_members pm ON p.project_id = pm.project_id
      WHERE pm.user_id = $1
    `, [userId]);

    res.json({ projects: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});



// Get all projects for a user
// Get all projects for a user
router.get('/projects', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId; // ✅ use userId, not id
    const userRole = req.user.role;

    let query;
    let params = [];

    if (userRole === 'ADMIN') {
      query = `SELECT * FROM projects ORDER BY project_id DESC`;
    } else {
      query = `
        SELECT p.*, pm.role as member_role
        FROM projects p
        JOIN project_members pm ON p.project_id = pm.project_id
        WHERE pm.user_id = $1
        ORDER BY p.project_id DESC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);

    res.json({ projects: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch projects' });
  }
});


// Get project by ID
router.get('/projects/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT * FROM projects WHERE project_id = $1 AND user_id = $2`,
      [id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ project: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch project' });
  }
});

// Update project
router.put('/projects/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { project_name, start_date, end_date, comment } = req.body;
  const user_id = req.user.userId;

  try {
    const result = await pool.query(
      `UPDATE projects 
       SET "project-name" = $1, "start-date" = $2, "end-date" = $3, comment = $4 
       WHERE project_id = $5 AND user_id = $6 
       RETURNING *`,
      [project_name, start_date, end_date, comment, id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({
      message: 'Project updated successfully',
      project: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// Delete project
router.delete('/projects/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.userId;

  try {
    // First delete associated tasks
    await pool.query('DELETE FROM tasks WHERE project_id = $1', [id]);

    // Then delete the project
    const result = await pool.query(
      'DELETE FROM projects WHERE project_id = $1 AND user_id = $2 RETURNING *',
      [id, user_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ==================== TASK ENDPOINTS ====================

// Create a new task
router.post('/tasks', authenticate, async (req, res) => {
  const { task_name, task_description, project_id } = req.body;

  try {
    // Verify project belongs to user
    const projectCheck = await pool.query(
      'SELECT * FROM projects WHERE project_id = $1 AND user_id = $2',
      [project_id, req.user.userId]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const result = await pool.query(
      `INSERT INTO tasks (task_name, "task-description", project_id) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [task_name, task_description, project_id]
    );

    res.status(201).json({
      message: 'Task created successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create task' });
  }
});

// Get all tasks for a project
router.get('/projects/:projectId/tasks', authenticate, async (req, res) => {
  const { projectId } = req.params;
  const user_id = req.user.userId;

  try {
    // Verify project belongs to user
    const projectCheck = await pool.query(
      'SELECT * FROM projects WHERE project_id = $1 AND user_id = $2',
      [projectId, user_id]
    );

    if (projectCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const result = await pool.query(
      `SELECT t.*, p."project-name" 
       FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.project_id = $1 
       ORDER BY t.task_id DESC`,
      [projectId]
    );

    res.json({ tasks: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
});

// Get task by ID
router.get('/tasks/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT t.*, p."project-name", p.user_id 
       FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.task_id = $1 AND p.user_id = $2`,
      [id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.json({ task: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});

// Update task
router.put('/tasks/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const { task_name, task_description, project_id } = req.body;

  try {
    // Verify task belongs to user
    const taskCheck = await pool.query(
      `SELECT t.* FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.task_id = $1 AND p.user_id = $2`,
      [id, req.user.userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const result = await pool.query(
      `UPDATE tasks 
       SET task_name = $1, "task-description" = $2, project_id = $3 
       WHERE task_id = $4 
       RETURNING *`,
      [task_name, task_description, project_id, id]
    );

    res.json({
      message: 'Task updated successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});

// Delete task
router.delete('/tasks/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    // Verify task belongs to user
    const taskCheck = await pool.query(
      `SELECT t.* FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.task_id = $1 AND p.user_id = $2`,
      [id, req.user.userId]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const result = await pool.query(
      'DELETE FROM tasks WHERE task_id = $1 RETURNING *',
      [id]
    );

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to delete task' });
  }
});

// ==================== DASHBOARD STATS ====================

// Get dashboard statistics
router.get('/dashboard/stats', authenticate, async (req, res) => {
  const user_id = req.user.userId;

  try {
    const projectsCount = await pool.query(
      'SELECT COUNT(*) FROM projects WHERE user_id = $1',
      [user_id]
    );

    const tasksCount = await pool.query(
      `SELECT COUNT(*) FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE p.user_id = $1`,
      [user_id]
    );

    const recentProjects = await pool.query(
      `SELECT * FROM projects 
       WHERE user_id = $1 
       ORDER BY project_id DESC 
       LIMIT 5`,
      [user_id]
    );

    res.json({
      stats: {
        totalProjects: parseInt(projectsCount.rows[0].count),
        totalTasks: parseInt(tasksCount.rows[0].count),
        recentProjects: recentProjects.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// ==================== USER MANAGEMENT ENDPOINTS ====================

// Get all users (for team member selection)
router.get('/users', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, role FROM "User" ORDER BY email ASC'
    );

    console.log('Users fetched:', result.rows.length);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Search users by email
router.get('/users/search/:email', authenticate, async (req, res) => {
  try {
    const { email } = req.params;
    console.log('Searching users with email:', email);

    const result = await pool.query(
      'SELECT id, email, role FROM "User" WHERE email ILIKE $1 ORDER BY email ASC',
      [`%${email}%`]
    );

    console.log('Search results:', result.rows.length);
    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error searching users:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
});

// Get users by IDs (for batch user lookup)
router.post('/users/batch', authenticate, async (req, res) => {
  try {
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ message: 'User IDs array is required' });
    }

    console.log('Fetching users batch:', userIds);

    const result = await pool.query(
      'SELECT id, email, role FROM "User" WHERE id = ANY($1) ORDER BY email ASC',
      [userIds]
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Error fetching users batch:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Get current user profile
router.get('/profile', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      'SELECT id, email, role FROM "User" WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

module.exports = router;