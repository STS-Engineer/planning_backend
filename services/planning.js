const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');


JWT_SECRET = '12345';
JWT_REFRESH_SECRET = '123456';
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

const transporter = nodemailer.createTransport({
  host: "avocarbon-com.mail.protection.outlook.com",
  port: 25,
  secure: false,
  auth: {
    user: "administration.STS@avocarbon.com",
    pass: "shnlgdyfbcztbhxn",
  },
});

const sendAssignmentEmail = async (to, name, projectName, startDate, endDate) => {
  try {
    await transporter.sendMail({
      from: '"STS Project Management" <administration.STS@avocarbon.com>',
      to, // recipient email
      subject: `You have been assigned to a new project: ${projectName}`,
      html: `
         <p>Dear ${name},</p>
        <p>You have been assigned to a new project:</p>
        <ul>
          <li><strong>Project Name:</strong> ${projectName}</li>
          <li><strong>Start Date:</strong> ${startDate}</li>
          <li><strong>End Date:</strong> ${endDate}</li>
        </ul>
        <p>Please check your <a href="https://sts-project-management.azurewebsites.net/dashboard" target="_blank">dashboard</a> for more details.</p>
        <p>Regards,<br/>STS Project Management Team</p>
      `,
    });
  } catch (err) {
    console.error('Failed to send email:', err);
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


router.post('/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(401).json({ message: 'No refresh token provided' });
  }

  try {
    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);

    const result = await pool.query(
      'SELECT * FROM "User" WHERE id = $1 AND refresh_token = $2',
      [decoded.userId, refreshToken]
    );

    const user = result.rows[0];
    if (!user) {
      return res.status(403).json({ message: 'Invalid refresh token' });
    }

    const newAccessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({ accessToken: newAccessToken });
  } catch (err) {
    return res.status(403).json({ message: 'Refresh token expired or invalid' });
  }
});


router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const result = await pool.query(
      'SELECT * FROM "User" WHERE email = $1',
      [email]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // ✅ Access Token (SHORT)
    const accessToken = jwt.sign(
      {
        userId: user.id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    // ✅ Refresh Token (LONG)
    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '9d' }
    );

    // OPTIONAL (recommended): store refresh token in DB
    await pool.query(
      'UPDATE "User" SET refresh_token = $1 WHERE id = $2',
      [refreshToken, user.id]
    );

    res.status(200).json({
      message: 'Login successful',
      accessToken,
      refreshToken,
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

const getNameFromEmail = (email) => {
  if (!email) return "User";

  // Get part before @
  const namePart = email.split('@')[0]; // "john.doe"

  // Replace dots/underscores with space
  const nameWithSpaces = namePart.replace(/[._]/g, ' '); // "john doe"

  // Capitalize first letter of each word
  const formattedName = nameWithSpaces.replace(/\b\w/g, char => char.toUpperCase()); // "John Doe"

  return formattedName;
};

// Create a new project
router.post('/projects', authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const {
      project_name,
      start_date,
      end_date,
      comment,
      members = [] // array of user IDs
    } = req.body;

    const creatorId = req.user.userId;

    await client.query('BEGIN');

    // 1️⃣ Create project
    const projectResult = await client.query(
      `
      INSERT INTO projects ("project-name", "start-date", "end-date", comment, user_id)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING project_id
      `,
      [project_name, start_date, end_date, comment, creatorId]
    );

    const projectId = projectResult.rows[0].project_id;

    // 2️⃣ Add selected members and send emails
    for (const memberId of members) {
      await client.query(
        `
    INSERT INTO project_members (project_id, user_id, role)
    VALUES ($1, $2, 'member')
    ON CONFLICT (project_id, user_id) DO NOTHING
    `,
        [projectId, memberId]
      );

      // Get member email
      const { rows } = await client.query('SELECT email FROM "User" WHERE id = $1', [memberId]);
      const email = rows[0]?.email;
      const fullName = getNameFromEmail(email);

      if (email) {
        await sendAssignmentEmail(email, fullName, project_name, start_date, end_date);
      }
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
router.get('/projects', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;
    const userRole = req.user.role;

    let query;
    let params = [];

    if (userRole === 'ADMIN') {
      query = `
        SELECT 
          p.*,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', u.id,
                'email', u.email,
                'role', pm.role
              )
            ) FILTER (WHERE u.id IS NOT NULL),
            '[]'
          ) AS members
        FROM projects p
        LEFT JOIN project_members pm 
          ON p.project_id = pm.project_id
        LEFT JOIN public."User" u 
          ON pm.user_id = u.id
        GROUP BY p.project_id
        ORDER BY p.project_id DESC
      `;
    } else {
      query = `
        SELECT 
          p.*,
          COALESCE(
            json_agg(
              DISTINCT jsonb_build_object(
                'id', u.id,
                'email', u.email,
                'role', pm.role
              )
            ) FILTER (WHERE u.id IS NOT NULL),
            '[]'
          ) AS members
        FROM projects p
        JOIN project_members pm_filter
          ON p.project_id = pm_filter.project_id
        LEFT JOIN project_members pm
          ON p.project_id = pm.project_id
        LEFT JOIN public."User" u
          ON pm.user_id = u.id
        WHERE pm_filter.user_id = $1
        GROUP BY p.project_id
        ORDER BY p.project_id DESC
      `;
      params = [userId];
    }

    const result = await pool.query(query, params);

    console.log('Projects result:', result.rows); // 🔍 debug

    res.json({ projects: result.rows });
  } catch (error) {
    console.error('Failed to fetch projects:', error);
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

// ==================== TASK ENDPOINTS ====================

// Helper function to check if user has access to project
const hasProjectAccess = async (projectId, userId, userRole) => {
  if (userRole === 'ADMIN') {
    return true; // Admins have access to all projects
  }

  // Check if user is the project owner
  const ownerCheck = await pool.query(
    'SELECT * FROM projects WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );

  if (ownerCheck.rows.length > 0) {
    return true; // User is the project owner
  }

  // Check if user is a project member
  const memberCheck = await pool.query(
    'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
    [projectId, userId]
  );

  return memberCheck.rows.length > 0; // User is a project member
};

// Create a new task (UPDATED WITH STATUS)
router.post('/tasks', authenticate, async (req, res) => {
  const {
    task_name,
    task_description,
    project_id,
    status = 'todo',
    assignee_id,  // This might be coming as a string
    start_date = null,
    end_date = null
  } = req.body;

  try {
    console.log("🔍 RAW REQUEST BODY:", req.body);
    console.log("🔍 assignee_id from request:", assignee_id, "Type:", typeof assignee_id);

    // Parse assignee_id to integer if it exists
    let parsedAssigneeId = null;
    if (assignee_id !== undefined && assignee_id !== null && assignee_id !== '') {
      parsedAssigneeId = parseInt(assignee_id);
      console.log("🔍 Parsed assignee_id:", parsedAssigneeId, "Type:", typeof parsedAssigneeId);

      if (isNaN(parsedAssigneeId)) {
        console.log("❌ Invalid assignee_id format:", assignee_id);
        return res.status(400).json({
          message: 'Invalid assignee ID format. Must be a number.'
        });
      }
    }

    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(project_id, req.user.userId, req.user.role);

    if (!hasAccess) {
      console.log('Access denied: User does not have access to this project');
      return res.status(403).json({ message: 'Access denied: You do not have access to this project' });
    }

    // If assignee_id is provided, validate they are a project member
    if (parsedAssigneeId) {
      console.log("🔍 Validating assignee:", parsedAssigneeId);

      const isProjectMember = await pool.query(
        'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
        [project_id, parsedAssigneeId]
      );

      console.log("🔍 Project member check result:", isProjectMember.rows);

      if (isProjectMember.rows.length === 0) {
        console.log("❌ Assignee is not a project member");
        return res.status(400).json({
          message: 'Assignee must be a member of the project'
        });
      }
    }

    console.log("💾 Inserting task with assignee_id:", parsedAssigneeId);

    const result = await pool.query(
      `INSERT INTO tasks (
        task_name, 
        "task-description", 
        project_id, 
        status,
        assignee_id,
        "start-date",
        "end-date"
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        task_name,
        task_description,
        project_id,
        status,
        parsedAssigneeId,  // Use the parsed integer
        start_date,
        end_date
      ]
    );

    console.log("✅ Task created successfully:", result.rows[0]);
    console.log("✅ Task assignee_id in database:", result.rows[0].assignee_id);

    // Get assignee details if assigned
    let assignee = null;
    if (parsedAssigneeId) {
      const assigneeResult = await pool.query(
        'SELECT id, email FROM "User" WHERE id = $1',
        [parsedAssigneeId]
      );
      if (assigneeResult.rows.length > 0) {
        assignee = {
          id: assigneeResult.rows[0].id,
          email: assigneeResult.rows[0].email,
          name: getNameFromEmail(assigneeResult.rows[0].email)
        };
      }
    }

    res.status(201).json({
      message: 'Task created successfully',
      task: {
        ...result.rows[0],
        assignee
      }
    });
  } catch (error) {
    console.error('Error creating task:', error);
    console.error('Error details:', error.message);
    console.error('Error code:', error.code);

    // Check for specific database errors
    if (error.code === '23503') { // Foreign key violation
      if (error.constraint === 'tasks_assignee_id_fkey') {
        console.error('Foreign key violation: The assignee_id does not exist in User table');
        return res.status(400).json({
          message: 'Assignee not found in system'
        });
      }
    }

    res.status(500).json({
      error: 'Failed to create task',
      details: error.message
    });
  }
});

// Get project members for assignee selection
router.get('/projects/:projectId/members', authenticate, async (req, res) => {
  const { projectId } = req.params;

  try {
    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(projectId, req.user.userId, req.user.role);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const result = await pool.query(
      `SELECT 
        u.id,
        u.email,
        u.role as user_role,
        pm.role as project_role,
        pm.joined_at
       FROM project_members pm
       JOIN "User" u ON pm.user_id = u.id
       WHERE pm.project_id = $1
       ORDER BY u.email ASC`,
      [projectId]
    );

    const members = result.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: getNameFromEmail(row.email),
      userRole: row.user_role,
      projectRole: row.project_role,
      joinedAt: row.joined_at
    }));

    res.json({ members });
  } catch (error) {
    console.error('Error fetching project members:', error);
    res.status(500).json({ error: 'Failed to fetch project members' });
  }
});

// Get all tasks for a project (UPDATED - only allow assigning to project members)
router.get('/projects/:projectId/tasks', authenticate, async (req, res) => {
  const { projectId } = req.params;

  try {
    console.log('Get tasks request:', { projectId, userId: req.user.userId, role: req.user.role });

    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(projectId, req.user.userId, req.user.role);

    if (!hasAccess) {
      console.log('Access denied: User does not have access to this project');
      return res.status(403).json({ message: 'Access denied: You do not have access to this project' });
    }

    // Get tasks with assignee info (only if assignee is a project member)
    const result = await pool.query(
      `SELECT 
        t.*, 
        p."project-name",
        u.id as assignee_user_id,
        u.email as assignee_email,
        pm.project_id as assignee_in_project
       FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       LEFT JOIN "User" u ON t.assignee_id = u.id
       LEFT JOIN project_members pm ON t.assignee_id = pm.user_id AND pm.project_id = t.project_id
       WHERE t.project_id = $1 
       ORDER BY t.task_id DESC`,
      [projectId]
    );

    // Transform the results to include assignee object
    const tasks = result.rows.map(task => ({
      ...task,
      assignee: task.assignee_user_id && task.assignee_in_project ? {
        id: task.assignee_user_id,
        email: task.assignee_email,
        name: getNameFromEmail(task.assignee_email),
        isProjectMember: true
      } : null
    }));

    console.log(`Found ${tasks.length} tasks for project ${projectId}`);

    res.json({ tasks });

  } catch (error) {
    console.error('Error fetching tasks:', error);
    res.status(500).json({ error: 'Failed to fetch tasks', details: error.message });
  }
});



// Get task by ID (UPDATED)
router.get('/tasks/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT t.*, p."project-name", p.project_id 
       FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.task_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = result.rows[0];

    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(task.project_id, req.user.userId, req.user.role);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    res.json({ task });
  } catch (error) {
    console.error('Error fetching task:', error);
    res.status(500).json({ error: 'Failed to fetch task' });
  }
});


// Update task assignee
router.patch('/tasks/:id/assignee', authenticate, async (req, res) => {
  const { id } = req.params;
  const { assignee_id } = req.body;  // This might be string

  try {
    console.log("🔍 Update assignee request:", { taskId: id, assignee_id, type: typeof assignee_id });

    // Get the task first to check project access
    const taskCheck = await pool.query(
      `SELECT t.*, p.project_id FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.task_id = $1`,
      [id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = taskCheck.rows[0];
    const projectId = task.project_id;

    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(projectId, req.user.userId, req.user.role);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Parse assignee_id to integer if provided
    let parsedAssigneeId = null;
    if (assignee_id !== undefined && assignee_id !== null && assignee_id !== '') {
      parsedAssigneeId = parseInt(assignee_id);
      console.log("🔍 Parsed assignee_id:", parsedAssigneeId);

      if (isNaN(parsedAssigneeId)) {
        return res.status(400).json({
          message: 'Invalid assignee ID format'
        });
      }

      // Check if assignee is a project member
      const isProjectMember = await pool.query(
        'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
        [projectId, parsedAssigneeId]
      );

      if (isProjectMember.rows.length === 0) {
        return res.status(400).json({
          message: 'Assignee must be a member of the project'
        });
      }
    }

    // Update task assignee
    const result = await pool.query(
      `UPDATE tasks 
       SET assignee_id = $1 
       WHERE task_id = $2 
       RETURNING *`,
      [parsedAssigneeId, id]  // Use parsed integer
    );

    console.log("✅ Task assignee updated:", result.rows[0]);

    // Get assignee details if assigned
    let assignee = null;
    if (parsedAssigneeId) {
      const assigneeResult = await pool.query(
        'SELECT id, email FROM "User" WHERE id = $1',
        [parsedAssigneeId]
      );
      if (assigneeResult.rows.length > 0) {
        assignee = {
          id: assigneeResult.rows[0].id,
          email: assigneeResult.rows[0].email,
          name: getNameFromEmail(assigneeResult.rows[0].email)
        };
      }
    }

    res.json({
      message: 'Task assignee updated successfully',
      task: {
        ...result.rows[0],
        assignee
      }
    });
  } catch (error) {
    console.error('Error updating task assignee:', error);
    res.status(500).json({ error: 'Failed to update task assignee' });
  }
});

// Update task dates
router.patch('/tasks/:id/dates', authenticate, async (req, res) => {
  const { id } = req.params;
  const { start_date, end_date } = req.body;

  try {
    console.log('Update task dates request:', { taskId: id, start_date, end_date, userId: req.user.userId });

    // Get the task first to check project access
    const taskCheck = await pool.query(
      `SELECT t.*, p.project_id FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.task_id = $1`,
      [id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(task.project_id, req.user.userId, req.user.role);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update task dates
    const result = await pool.query(
      `UPDATE tasks 
       SET "start-date" = $1, "end-date" = $2
       WHERE task_id = $3 
       RETURNING *`,
      [start_date || null, end_date || null, id]
    );

    console.log('Task dates updated successfully:', result.rows[0]);

    res.json({
      message: 'Task dates updated successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating task dates:', error);
    res.status(500).json({ error: 'Failed to update task dates', details: error.message });
  }
});

// Update task (UPDATED)
// Update task (COMPREHENSIVE UPDATE)
// Update task (COMPREHENSIVE UPDATE - validate assignee is project member)
router.put('/tasks/:id', authenticate, async (req, res) => {
  const { id } = req.params;
  const {
    task_name,
    task_description,
    project_id,
    assignee_id,
    start_date,
    end_date
  } = req.body;

  try {
    // Get the task first to check project access
    const taskCheck = await pool.query(
      `SELECT t.*, p.project_id FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.task_id = $1`,
      [id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = taskCheck.rows[0];
    const currentProjectId = task.project_id;

    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(currentProjectId, req.user.userId, req.user.role);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // If assignee_id is provided, check if user is a project member
    if (assignee_id !== undefined && assignee_id !== null) {
      const isProjectMember = await pool.query(
        'SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2',
        [currentProjectId, assignee_id]
      );

      if (isProjectMember.rows.length === 0) {
        return res.status(400).json({
          message: 'Assignee must be a member of the project'
        });
      }
    }

    const result = await pool.query(
      `UPDATE tasks 
       SET task_name = COALESCE($1, task_name),
           "task-description" = COALESCE($2, "task-description"),
           assignee_id = $3,
           "start-date" = COALESCE($4, "start-date"),
           "end-date" = COALESCE($5, "end-date")
       WHERE task_id = $6 
       RETURNING *`,
      [
        task_name,
        task_description,
        assignee_id !== undefined ? assignee_id : task.assignee_id,
        start_date,
        end_date,
        id
      ]
    );

    // Get assignee details if assigned
    let assignee = null;
    const finalAssigneeId = assignee_id !== undefined ? assignee_id : task.assignee_id;

    if (finalAssigneeId) {
      const assigneeResult = await pool.query(
        'SELECT id, email FROM "User" WHERE id = $1',
        [finalAssigneeId]
      );
      if (assigneeResult.rows.length > 0) {
        assignee = {
          id: assigneeResult.rows[0].id,
          email: assigneeResult.rows[0].email,
          name: getNameFromEmail(assigneeResult.rows[0].email)
        };
      }
    }

    const updatedTask = {
      ...result.rows[0],
      assignee
    };

    res.json({
      message: 'Task updated successfully',
      task: updatedTask
    });
  } catch (error) {
    console.error('Error updating task:', error);
    res.status(500).json({ error: 'Failed to update task' });
  }
});
// Update task status - NEW ENDPOINT FOR DRAG & DROP
router.patch('/tasks/:id/status', authenticate, async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    console.log('Update task status request:', { taskId: id, newStatus: status, userId: req.user.userId });

    // Validate status
    const validStatuses = ['todo', 'in_progress', 'done'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be one of: todo, in_progress, done' });
    }

    // Get the task first to check project access
    const taskCheck = await pool.query(
      `SELECT t.*, p.project_id FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.task_id = $1`,
      [id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(task.project_id, req.user.userId, req.user.role);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Update task status
    const result = await pool.query(
      `UPDATE tasks 
       SET status = $1 
       WHERE task_id = $2 
       RETURNING *`,
      [status, id]
    );

    console.log('Task status updated successfully:', result.rows[0]);

    res.json({
      message: 'Task status updated successfully',
      task: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating task status:', error);
    res.status(500).json({ error: 'Failed to update task status', details: error.message });
  }
});

// Delete task (UPDATED)
// Delete task (UPDATED)
router.delete('/tasks/:id', authenticate, async (req, res) => {
  const { id } = req.params;

  try {
    // Get the task first to check project access
    const taskCheck = await pool.query(
      `SELECT t.*, p.project_id FROM tasks t 
       JOIN projects p ON t.project_id = p.project_id 
       WHERE t.task_id = $1`,
      [id]
    );

    if (taskCheck.rows.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }

    const task = taskCheck.rows[0];

    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(task.project_id, req.user.userId, req.user.role);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    await pool.query('DELETE FROM tasks WHERE task_id = $1', [id]);

    res.json({ message: 'Task deleted successfully' });
  } catch (error) {
    console.error('Error deleting task:', error);
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



router.get('/statistics/summary', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const role = req.user.role;

  try {
    let projectCondition = '';
    let params = [];

    if (role !== 'ADMIN') {
      projectCondition = `
        WHERE p.project_id IN (
          SELECT project_id FROM project_members WHERE user_id = $1
        )
      `;
      params = [userId];
    }

    const result = await pool.query(`
      SELECT
        COUNT(DISTINCT p.project_id) AS total_projects,
        COUNT(t.task_id) AS total_tasks,
        COUNT(t.task_id) FILTER (WHERE t.status = 'done') AS completed_tasks
      FROM projects p
      LEFT JOIN tasks t ON p.project_id = t.project_id
      ${projectCondition}
    `, params);

    const row = result.rows[0];

    const completionRate = row.total_tasks > 0
      ? Math.round((row.completed_tasks / row.total_tasks) * 100)
      : 0;

    res.json({
      totalProjects: Number(row.total_projects),
      totalTasks: Number(row.total_tasks),
      completedTasks: Number(row.completed_tasks),
      completionRate
    });

  } catch (error) {
    console.error('Global statistics error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics summary' });
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

// Add this endpoint to your backend
router.get('/statistics/project/:projectId', authenticate, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId;
  const role = req.user.role;

  try {
    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(projectId, userId, role);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 1. Get basic project info
    const projectResult = await pool.query(
      `SELECT * FROM projects WHERE project_id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const project = projectResult.rows[0];

    // Parse dates - handle empty or invalid dates
    let startDate, endDate;
    try {
      startDate = project['start-date'] ? new Date(project['start-date']) : new Date();
      endDate = project['end-date'] ? new Date(project['end-date']) : new Date();
    } catch (error) {
      console.error('Error parsing dates:', error);
      startDate = new Date();
      endDate = new Date();
    }

    const today = new Date();

    // Calculate time-related metrics
    const projectDuration = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
    const daysElapsed = Math.min(Math.max(0, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24))), projectDuration);
    const daysRemaining = Math.max(0, projectDuration - daysElapsed);
    const progressPercentage = projectDuration > 0 ? Math.round((daysElapsed / projectDuration) * 100) : 0;

    // 2. Get task statistics
    const tasksResult = await pool.query(
      `SELECT 
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE status = 'todo') as todo_tasks,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
                COUNT(*) FILTER (WHERE status = 'done') as done_tasks,
                COUNT(*) FILTER (WHERE assignee_id IS NOT NULL) as assigned_tasks,
                COUNT(*) FILTER (WHERE assignee_id IS NULL) as unassigned_tasks
             FROM tasks 
             WHERE project_id = $1`,
      [projectId]
    );

    const tasks = tasksResult.rows[0];
    const totalTasks = Number(tasks.total_tasks) || 0;
    const doneTasks = Number(tasks.done_tasks) || 0;
    const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

    // 3. Calculate average tasks per day
    const daysSinceStart = Math.max(1, daysElapsed);
    const avgTasksPerDay = totalTasks > 0 ? parseFloat((totalTasks / daysSinceStart).toFixed(1)) : 0;

    // 4. Get task status distribution for charts
    const statusDistribution = [
      {
        name: 'To Do',
        value: Number(tasks.todo_tasks) || 0,
        color: '#ff6b6b'
      },
      {
        name: 'In Progress',
        value: Number(tasks.in_progress_tasks) || 0,
        color: '#ffd93d'
      },
      {
        name: 'Done',
        value: Number(tasks.done_tasks) || 0,
        color: '#4ecdc4'
      }
    ];

    // 5. Get assignment distribution (assigned vs unassigned)
    const assignmentDistribution = [
      {
        name: 'Assigned',
        value: Number(tasks.assigned_tasks) || 0,
        color: '#667eea'
      },
      {
        name: 'Unassigned',
        value: Number(tasks.unassigned_tasks) || 0,
        color: '#c7ceea'
      }
    ];

    // 6. Get tasks created per day for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyStatsResult = await pool.query(
      `SELECT 
                DATE(created_at) as date,
                COUNT(*) as tasks_created,
                COUNT(*) FILTER (WHERE status = 'done') as tasks_completed
             FROM tasks 
             WHERE project_id = $1 
                AND created_at >= $2
             GROUP BY DATE(created_at)
             ORDER BY date`,
      [projectId, thirtyDaysAgo]
    );

    // Prepare daily tasks data for chart
    const dailyTasks = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      const dateStr = date.toISOString().split('T')[0];

      const dayData = dailyStatsResult.rows.find(row => {
        if (!row.date) return false;
        const rowDate = new Date(row.date).toISOString().split('T')[0];
        return rowDate === dateStr;
      });

      dailyTasks.push({
        date: dateStr,
        tasksCreated: dayData ? Number(dayData.tasks_created) : 0,
        tasksCompleted: dayData ? Number(dayData.tasks_completed) : 0
      });
    }

    // 7. Get member contribution statistics
    const memberContribution = await pool.query(
      `SELECT 
                u.id,
                u.email,
                COUNT(t.task_id) as tasks_assigned,
                COUNT(t.task_id) FILTER (WHERE t.status = 'done') as tasks_completed
             FROM project_members pm
             JOIN "User" u ON pm.user_id = u.id
             LEFT JOIN tasks t ON t.assignee_id = u.id AND t.project_id = $1
             WHERE pm.project_id = $1
             GROUP BY u.id, u.email
             ORDER BY tasks_assigned DESC`,
      [projectId]
    );

    const memberStats = memberContribution.rows.map(row => ({
      id: row.id,
      email: row.email,
      name: row.email ? row.email.split('@')[0].replace(/\./g, ' ') : 'Unknown',
      tasksAssigned: Number(row.tasks_assigned) || 0,
      tasksCompleted: Number(row.tasks_completed) || 0,
      completionRate: row.tasks_assigned > 0
        ? Math.round((row.tasks_completed / row.tasks_assigned) * 100)
        : 0
    }));

    // 8. Get project members count
    const membersResult = await pool.query(
      `SELECT COUNT(*) as total_members FROM project_members WHERE project_id = $1`,
      [projectId]
    );
    const totalMembers = Number(membersResult.rows[0]?.total_members) || 0;

    // Return all statistics
    res.json({
      totalTasks: totalTasks,
      todoTasks: Number(tasks.todo_tasks) || 0,
      inProgressTasks: Number(tasks.in_progress_tasks) || 0,
      doneTasks: doneTasks,
      completionRate: completionRate,
      avgTasksPerDay: avgTasksPerDay,
      projectDuration: projectDuration,
      daysRemaining: daysRemaining,
      daysElapsed: daysElapsed,
      progressPercentage: progressPercentage,
      tasksDistribution: statusDistribution,
      assignmentDistribution: assignmentDistribution,
      dailyTasks: dailyTasks,
      memberStats: memberStats,
      totalMembers: totalMembers,
      assignedTasks: Number(tasks.assigned_tasks) || 0,
      unassignedTasks: Number(tasks.unassigned_tasks) || 0,
      projectName: project['project-name'] || 'Unnamed Project',
      startDate: project['start-date'] || 'Not set',
      endDate: project['end-date'] || 'Not set',
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching project statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch project statistics',
      details: error.message
    });
  }
});


// Update project status (validate/completed/archive)
router.put('/projects/:id/status', authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const projectId = req.params.id;
    const { status } = req.body;
    const userId = req.user.userId;

    // Validate status
    const validStatuses = ['active', 'completed', 'validated', 'archived'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    // Check if user has permission (admin or project member)
    const permissionCheck = await client.query(
      `SELECT * FROM project_members WHERE project_id = $1 AND user_id = $2`,
      [projectId, userId]
    );

    const userRole = req.user.role;
    if (userRole !== 'ADMIN' && permissionCheck.rows.length === 0) {
      return res.status(403).json({ error: 'Not authorized to update project status' });
    }

    // Update project status - FIXED: Use the status variable, not hardcoded 'completed'
    const result = await client.query(
      `UPDATE projects SET status = $1  WHERE project_id = $2 RETURNING *`,
      [status, projectId] // <-- This was the bug: you had ['completed', projectId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }

    res.json({
      message: `Project status updated to ${status}`,
      project: result.rows[0]
    });

  } catch (error) {
    console.error('Update project status error:', error);
    res.status(500).json({ error: 'Failed to update project status' });
  } finally {
    client.release();
  }
});

// Get statistics for a specific member across all projects
// Get statistics for a specific member across all projects
router.get('/statistics/member/:memberId', authenticate, async (req, res) => {
  const { memberId } = req.params;
  const userId = req.user.userId;
  const role = req.user.role;

  try {
    // Verify the requesting user has access to view this member's stats
    // Admins can view anyone, regular users can only view their own stats
    if (role !== 'ADMIN' && userId !== parseInt(memberId)) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // 1. Get member basic info
    const memberResult = await pool.query(
      `SELECT id, email, role FROM "User" WHERE id = $1`,
      [memberId]
    );

    if (memberResult.rows.length === 0) {
      return res.status(404).json({ message: 'Member not found' });
    }

    const member = memberResult.rows[0];

    // 2. Get all projects where this member has tasks assigned OR is a project member
    const projectsQuery = `
            SELECT DISTINCT
                p.project_id,
                p."project-name" as project_name,
                p."start-date" as start_date,
                p."end-date" as end_date
            FROM projects p
            WHERE p.project_id IN (
                -- Projects where member has tasks
                SELECT DISTINCT project_id 
                FROM tasks 
                WHERE assignee_id = $1
                UNION
                -- Projects where member is a project member
                SELECT DISTINCT project_id 
                FROM project_members 
                WHERE user_id = $1
            )
            ORDER BY p.project_id DESC
        `;

    const projectsResult = await pool.query(projectsQuery, [memberId]);

    if (projectsResult.rows.length === 0) {
      // Member has no projects or tasks
      return res.json({
        member: {
          id: member.id,
          email: member.email,
          role: member.role,
          name: member.email ? member.email.split('@')[0].replace(/\./g, ' ') : `Member ${member.id}`
        },
        summary: {
          totalProjects: 0,
          totalTasks: 0,
          completedTasks: 0,
          overallCompletionRate: 0,
          avgTasksPerDay: 0,
          productivity: 'Low'
        },
        projects: []
      });
    }

    const projects = [];

    // 3. For each project, get the member's task statistics
    for (const project of projectsResult.rows) {
      const tasksResult = await pool.query(
        `SELECT 
                    COUNT(*) as total_tasks,
                    COUNT(*) FILTER (WHERE status = 'todo') as todo_tasks,
                    COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
                    COUNT(*) FILTER (WHERE status = 'done') as done_tasks
                 FROM tasks 
                 WHERE project_id = $1 AND assignee_id = $2`,
        [project.project_id, memberId]
      );

      const tasks = tasksResult.rows[0];
      const totalTasks = Number(tasks.total_tasks) || 0;
      const doneTasks = Number(tasks.done_tasks) || 0;
      const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      // Calculate time-related metrics
      let startDate, endDate;
      try {
        startDate = project.start_date ? new Date(project.start_date) : new Date();
        endDate = project.end_date ? new Date(project.end_date) : new Date();
      } catch (error) {
        startDate = new Date();
        endDate = new Date();
      }

      const today = new Date();
      const projectDuration = Math.max(1, Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)));
      const daysElapsed = Math.min(Math.max(0, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24))), projectDuration);
      const daysRemaining = Math.max(0, projectDuration - daysElapsed);
      const progressPercentage = projectDuration > 0 ? Math.round((daysElapsed / projectDuration) * 100) : 0;

      // Only include projects where the member has tasks
      if (totalTasks > 0) {
        projects.push({
          projectId: project.project_id,
          projectName: project.project_name || 'Unnamed Project',
          totalTasks: totalTasks,
          todoTasks: Number(tasks.todo_tasks) || 0,
          inProgressTasks: Number(tasks.in_progress_tasks) || 0,
          doneTasks: doneTasks,
          completionRate: completionRate,
          projectDuration: projectDuration,
          daysElapsed: daysElapsed,
          daysRemaining: daysRemaining,
          progressPercentage: progressPercentage,
          assignedTasks: totalTasks,
          unassignedTasks: 0, // For member view, all shown tasks are assigned to them
          totalMembers: 0 // We can add this if needed
        });
      }
    }

    // 4. Calculate overall statistics
    const totalTasks = projects.reduce((sum, p) => sum + p.totalTasks, 0);
    const completedTasks = projects.reduce((sum, p) => sum + p.doneTasks, 0);
    const overallCompletionRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    // Calculate avg tasks per day
    // Get the earliest task creation date for this member
    const earliestTaskResult = await pool.query(
      `SELECT MIN(created_at) as earliest_date 
             FROM tasks 
             WHERE assignee_id = $1 AND created_at IS NOT NULL`,
      [memberId]
    );

    let avgTasksPerDay = 0;
    if (earliestTaskResult.rows[0]?.earliest_date) {
      const earliestDate = new Date(earliestTaskResult.rows[0].earliest_date);
      const today = new Date();
      const daysSinceFirstTask = Math.max(1, Math.ceil((today - earliestDate) / (1000 * 60 * 60 * 24)));
      avgTasksPerDay = totalTasks > 0 ? parseFloat((totalTasks / daysSinceFirstTask).toFixed(1)) : 0;
    } else {
      // Fallback: use 30 days if no task dates available
      avgTasksPerDay = totalTasks > 0 ? parseFloat((totalTasks / 30).toFixed(1)) : 0;
    }

    const productivity = avgTasksPerDay > 3 ? 'High' : avgTasksPerDay > 1 ? 'Medium' : 'Low';

    res.json({
      member: {
        id: member.id,
        email: member.email,
        role: member.role,
        name: member.email ? member.email.split('@')[0].replace(/\./g, ' ') : `Member ${member.id}`
      },
      summary: {
        totalProjects: projects.length,
        totalTasks: totalTasks,
        completedTasks: completedTasks,
        overallCompletionRate: overallCompletionRate,
        avgTasksPerDay: avgTasksPerDay,
        productivity: productivity
      },
      projects: projects
    });

  } catch (error) {
    console.error('Error fetching member statistics:', error);
    res.status(500).json({
      error: 'Failed to fetch member statistics',
      details: error.message
    });
  }
});

// ==================== TIMELINE STATISTICS ENDPOINTS ====================

// Get project timeline data (daily progress over time)
router.get('/statistics/project/:projectId/timeline', authenticate, async (req, res) => {
  const { projectId } = req.params;
  const userId = req.user.userId;
  const role = req.user.role;

  try {
    // Check if user has access to this project
    const hasAccess = await hasProjectAccess(projectId, userId, role);

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Get project details
    const projectResult = await pool.query(
      `SELECT * FROM projects WHERE project_id = $1`,
      [projectId]
    );

    if (projectResult.rows.length === 0) {
      return res.status(404).json({ message: 'Project not found' });
    }

    const project = projectResult.rows[0];
    const startDate = project['start-date'] ? new Date(project['start-date']) : new Date();
    const today = new Date();

    // Calculate days since project started
    const daysSinceStart = Math.max(1, Math.ceil((today - startDate) / (1000 * 60 * 60 * 24)));
    const daysToShow = Math.min(daysSinceStart, 30); // Show max 30 days

    // Get daily task statistics
    const timelineResult = await pool.query(
      `SELECT 
                DATE(created_at) as date,
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE status = 'done') as completed_tasks,
                COUNT(*) FILTER (WHERE status = 'todo') as todo_tasks,
                COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_tasks,
                COUNT(DISTINCT assignee_id) as active_members
             FROM tasks 
             WHERE project_id = $1 
                AND created_at >= $2
             GROUP BY DATE(created_at)
             ORDER BY date`,
      [projectId, new Date(today.getTime() - (daysToShow * 24 * 60 * 60 * 1000))]
    );

    // Calculate cumulative progress
    let cumulativeTasks = 0;
    let cumulativeCompleted = 0;

    const timelineData = [];
    for (let i = 0; i < daysToShow; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() - (daysToShow - 1 - i));
      const dateStr = date.toISOString().split('T')[0];
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });

      const dayData = timelineResult.rows.find(row => {
        if (!row.date) return false;
        const rowDate = new Date(row.date).toISOString().split('T')[0];
        return rowDate === dateStr;
      });

      // Update cumulative counts
      if (dayData) {
        cumulativeTasks += Number(dayData.total_tasks) || 0;
        cumulativeCompleted += Number(dayData.completed_tasks) || 0;
      }

      // Calculate daily metrics
      const totalProjectTasks = await pool.query(
        `SELECT COUNT(*) as total FROM tasks WHERE project_id = $1`,
        [projectId]
      );
      const projectTotalTasks = Number(totalProjectTasks.rows[0]?.total) || 0;

      const progress = projectTotalTasks > 0
        ? Math.round((cumulativeCompleted / projectTotalTasks) * 100)
        : 0;

      timelineData.push({
        date: formattedDate,
        fullDate: dateStr,
        day: i + 1,
        progress: Math.min(progress, 100),
        tasksCompleted: cumulativeCompleted,
        tasksCreated: cumulativeTasks,
        dailyNewTasks: dayData ? Number(dayData.total_tasks) || 0 : 0,
        dailyCompletedTasks: dayData ? Number(dayData.completed_tasks) || 0 : 0,
        activeMembers: dayData ? Number(dayData.active_members) || 0 : 0,
        todoTasks: dayData ? Number(dayData.todo_tasks) || 0 : 0,
        inProgressTasks: dayData ? Number(dayData.in_progress_tasks) || 0 : 0
      });
    }

    // Calculate timeline insights
    const insights = {
      currentProgress: timelineData[timelineData.length - 1]?.progress || 0,
      averageDailyProgress: calculateAverageDailyProgress(timelineData),
      peakProgressDay: findPeakProgressDay(timelineData),
      progressTrend: calculateProgressTrend(timelineData),
      productivityScore: calculateProductivityScore(timelineData),
      consistencyScore: calculateConsistencyScore(timelineData)
    };

    res.json({
      timelineData: timelineData,
      insights: insights,
      projectInfo: {
        name: project['project-name'],
        startDate: project['start-date'],
        totalDays: daysToShow,
        hasData: timelineData.length > 0
      }
    });

  } catch (error) {
    console.error('Error fetching project timeline:', error);
    res.status(500).json({
      error: 'Failed to fetch project timeline',
      details: error.message
    });
  }
});

// Get aggregated timeline data for all projects
router.get('/statistics/timeline/aggregated', authenticate, async (req, res) => {
  const userId = req.user.userId;
  const role = req.user.role;

  try {
    let projectCondition = '';
    let params = [];

    if (role !== 'ADMIN') {
      projectCondition = `
                WHERE p.project_id IN (
                    SELECT project_id FROM project_members WHERE user_id = $1
                )
            `;
      params = [userId];
    }

    // Get the last 30 days of aggregated data
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const timelineResult = await pool.query(
      `SELECT 
                DATE(t.created_at) as date,
                COUNT(DISTINCT t.project_id) as active_projects,
                COUNT(t.task_id) as total_tasks,
                COUNT(t.task_id) FILTER (WHERE t.status = 'done') as completed_tasks,
                COUNT(DISTINCT t.assignee_id) as active_members
             FROM tasks t
             JOIN projects p ON t.project_id = p.project_id
             ${projectCondition}
             WHERE t.created_at >= $${params.length + 1}
             GROUP BY DATE(t.created_at)
             ORDER BY date`,
      [...params, thirtyDaysAgo]
    );

    // Process aggregated timeline data
    const timelineData = [];
    let cumulativeTasks = 0;
    let cumulativeCompleted = 0;

    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });

      const dayData = timelineResult.rows.find(row => {
        if (!row.date) return false;
        const rowDate = new Date(row.date).toISOString().split('T')[0];
        return rowDate === dateStr;
      });

      // Update cumulative counts
      if (dayData) {
        cumulativeTasks += Number(dayData.total_tasks) || 0;
        cumulativeCompleted += Number(dayData.completed_tasks) || 0;
      }

      // Calculate overall progress
      const totalTasksResult = await pool.query(
        `SELECT COUNT(*) as total 
                 FROM tasks t
                 JOIN projects p ON t.project_id = p.project_id
                 ${projectCondition}`,
        params
      );

      const totalAllTasks = Number(totalTasksResult.rows[0]?.total) || 0;
      const progress = totalAllTasks > 0
        ? Math.round((cumulativeCompleted / totalAllTasks) * 100)
        : 0;

      timelineData.push({
        date: formattedDate,
        fullDate: dateStr,
        day: i + 1,
        totalProgress: Math.min(progress, 100),
        completedTasks: cumulativeCompleted,
        newTasks: cumulativeTasks,
        dailyNewTasks: dayData ? Number(dayData.total_tasks) || 0 : 0,
        dailyCompletedTasks: dayData ? Number(dayData.completed_tasks) || 0 : 0,
        activeProjects: dayData ? Number(dayData.active_projects) || 0 : 0,
        activeMembers: dayData ? Number(dayData.active_members) || 0 : 0,
        productivity: dayData ? Math.round((Number(dayData.completed_tasks) / Math.max(1, Number(dayData.active_members))) * 100) : 0
      });
    }

    // Calculate aggregated insights
    const insights = {
      overallProgress: timelineData[timelineData.length - 1]?.totalProgress || 0,
      averageDailyProductivity: calculateAverageProductivity(timelineData),
      mostProductiveDay: findMostProductiveDay(timelineData),
      progressTrend: calculateAggregatedProgressTrend(timelineData),
      averageActiveProjects: calculateAverageActiveProjects(timelineData),
      teamEfficiency: calculateTeamEfficiency(timelineData)
    };

    res.json({
      timelineData: timelineData,
      insights: insights,
      summary: {
        totalDays: 30,
        hasData: timelineData.length > 0,
        dataPoints: timelineResult.rows.length
      }
    });

  } catch (error) {
    console.error('Error fetching aggregated timeline:', error);
    res.status(500).json({
      error: 'Failed to fetch aggregated timeline',
      details: error.message
    });
  }
});

function calculateMemberProgressTrend(timelineData) {
  if (timelineData.length < 7) return 0;
  const lastWeek = timelineData.slice(-7);
  const firstProgress = lastWeek[0].memberProgress || 0;
  const lastProgress = lastWeek[lastWeek.length - 1].memberProgress || 0;
  return parseFloat(((lastProgress - firstProgress) / Math.max(1, firstProgress) * 100).toFixed(1));
}

function calculateConsistencyScore(progressValues) {
  if (progressValues.length < 2) return 100;
  const avg = progressValues.reduce((a, b) => a + b, 0) / progressValues.length;
  const variance = progressValues.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / progressValues.length;
  return Math.max(0, 100 - Math.sqrt(variance) * 3);
}

// Add this endpoint to your backend routes
router.get('/statistics/member/:memberId/timeline', authenticate, async (req, res) => {
  const { memberId } = req.params;
  const userId = req.user.userId;
  const role = req.user.role;

  try {
    // Verify access (only ADMIN or the member themselves)
    if (role !== 'ADMIN' && userId.toString() !== memberId) {
      return res.status(403).json({ message: 'Access denied' });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Get member's daily task statistics
    const timelineResult = await pool.query(
      `SELECT 
                DATE(t.created_at) as date,
                COUNT(*) as total_tasks,
                COUNT(*) FILTER (WHERE t.status = 'done') as completed_tasks,
                COUNT(*) FILTER (WHERE t.status = 'todo') as todo_tasks,
                COUNT(*) FILTER (WHERE t.status = 'in_progress') as in_progress_tasks,
                COUNT(DISTINCT t.project_id) as active_projects
             FROM tasks t
             WHERE t.assignee_id = $1 
                AND t.created_at >= $2
             GROUP BY DATE(t.created_at)
             ORDER BY date`,
      [memberId, thirtyDaysAgo]
    );

    // Get member's overall statistics
    const memberStatsResult = await pool.query(
      `SELECT 
                COUNT(DISTINCT project_id) as total_projects,
                COUNT(*) as total_tasks_assigned,
                COUNT(*) FILTER (WHERE status = 'done') as total_tasks_completed
             FROM tasks 
             WHERE assignee_id = $1`,
      [memberId]
    );

    const memberStats = memberStatsResult.rows[0] || {};

    // Calculate cumulative progress
    let cumulativeTasks = 0;
    let cumulativeCompleted = 0;

    const timelineData = [];
    for (let i = 0; i < 30; i++) {
      const date = new Date(thirtyDaysAgo);
      date.setDate(date.getDate() + i);
      const dateStr = date.toISOString().split('T')[0];
      const formattedDate = date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });

      const dayData = timelineResult.rows.find(row => {
        if (!row.date) return false;
        const rowDate = new Date(row.date).toISOString().split('T')[0];
        return rowDate === dateStr;
      });

      // Update cumulative counts
      if (dayData) {
        cumulativeTasks += Number(dayData.total_tasks) || 0;
        cumulativeCompleted += Number(dayData.completed_tasks) || 0;
      }

      // Calculate member-specific metrics
      const totalAssigned = Number(memberStats.total_tasks_assigned) || 0;
      const memberProgress = totalAssigned > 0
        ? Math.round((cumulativeCompleted / totalAssigned) * 100)
        : 0;

      // Calculate productivity
      const activeProjects = dayData ? Number(dayData.active_projects) || 0 : 0;
      const dailyCompleted = dayData ? Number(dayData.completed_tasks) || 0 : 0;
      const dailyProductivity = activeProjects > 0 && dailyCompleted > 0
        ? Math.round((dailyCompleted / activeProjects) * 100)
        : 0;

      timelineData.push({
        date: formattedDate,
        fullDate: dateStr,
        day: i + 1,
        memberProgress: Math.min(memberProgress, 100),
        memberTasksCompleted: cumulativeCompleted,
        dailyCompletedTasks: dailyCompleted,
        memberProductivity: Math.min(dailyProductivity, 100),
        assignedTasks: totalAssigned,
        activeProjects: activeProjects,
        completionRate: Math.min(memberProgress, 100),
        todoTasks: dayData ? Number(dayData.todo_tasks) || 0 : 0,
        inProgressTasks: dayData ? Number(dayData.in_progress_tasks) || 0 : 0
      });
    }

    // Calculate member insights
    const insights = {
      memberProgress: timelineData[timelineData.length - 1]?.memberProgress || 0,
      averageDailyProgress: calculateAverageDailyProgress(timelineData.map(d => d.memberProgress)),
      mostProductiveDay: findMostProductiveDay(timelineData),
      memberProductivity: calculateAverageProductivity(timelineData),
      activeDays: timelineData.filter(d => d.dailyCompletedTasks > 0).length,
      progressTrend: calculateMemberProgressTrend(timelineData),
      consistencyScore: calculateConsistencyScore(timelineData.map(d => d.memberProgress)),
      avgTasksPerDay: parseFloat((timelineData.reduce((sum, day) => sum + (day.dailyCompletedTasks || 0), 0) / timelineData.length).toFixed(1))
    };

    res.json({
      timelineData: timelineData,
      insights: insights,
      memberInfo: {
        totalProjects: memberStats.total_projects || 0,
        totalTasksAssigned: memberStats.total_tasks_assigned || 0,
        totalTasksCompleted: memberStats.total_tasks_completed || 0
      }
    });

  } catch (error) {
    console.error('Error fetching member timeline:', error);
    res.status(500).json({
      error: 'Failed to fetch member timeline',
      details: error.message
    });
  }
});




// Helper functions for timeline calculations
function calculateAverageDailyProgress(progressValues) {
  if (progressValues.length < 2) return 0;
  const differences = [];
  for (let i = 1; i < progressValues.length; i++) {
    differences.push(progressValues[i] - progressValues[i - 1]);
  }
  const avg = differences.reduce((a, b) => a + b, 0) / differences.length;
  return parseFloat(avg.toFixed(1));
}


function findPeakProgressDay(timelineData) {
  if (timelineData.length === 0) return null;

  let maxProgress = 0;
  let peakDay = null;

  timelineData.forEach(day => {
    const dailyChange = day.progress - (timelineData.find(d => d.day === day.day - 1)?.progress || 0);
    if (dailyChange > maxProgress) {
      maxProgress = dailyChange;
      peakDay = day;
    }
  });

  return peakDay ? { date: peakDay.date, progressIncrease: maxProgress } : null;
}

function calculateProgressTrend(timelineData) {
  if (timelineData.length < 7) return 0;

  const lastWeek = timelineData.slice(-7);
  const firstProgress = lastWeek[0].progress || 0;
  const lastProgress = lastWeek[lastWeek.length - 1].progress || 0;

  return parseFloat(((lastProgress - firstProgress) / Math.max(1, firstProgress) * 100).toFixed(1));
}

function calculateProductivityScore(timelineData) {
  if (timelineData.length === 0) return 0;

  const completedTasks = timelineData.reduce((sum, day) => sum + (day.dailyCompletedTasks || 0), 0);
  const totalDays = timelineData.length;

  return Math.round((completedTasks / totalDays) * 10) / 10; // Score out of 10
}

function calculateConsistencyScore(timelineData) {
  if (timelineData.length < 2) return 100;

  const progressChanges = [];
  for (let i = 1; i < timelineData.length; i++) {
    progressChanges.push(timelineData[i].progress - timelineData[i - 1].progress);
  }

  const avgChange = progressChanges.reduce((a, b) => a + b, 0) / progressChanges.length;
  const variance = progressChanges.reduce((sum, change) => sum + Math.pow(change - avgChange, 2), 0) / progressChanges.length;

  // Convert to score (0-100), lower variance = higher consistency
  const maxVariance = 10; // Assuming max variance of 10% daily change
  const consistency = Math.max(0, 100 - (variance / maxVariance * 100));

  return Math.round(consistency);
}

function calculateAverageProductivity(timelineData) {
  if (!timelineData.length) return 0;
  const sum = timelineData.reduce((acc, day) => acc + (day.memberProductivity || 0), 0);
  return parseFloat((sum / timelineData.length).toFixed(1));
}

function findMostProductiveDay(timelineData) {
  if (!timelineData.length) return null;
  let maxTasks = 0;
  let productiveDay = null;

  timelineData.forEach(day => {
    if (day.dailyCompletedTasks > maxTasks) {
      maxTasks = day.dailyCompletedTasks;
      productiveDay = day;
    }
  });

  return productiveDay ? {
    date: productiveDay.date,
    tasks: productiveDay.dailyCompletedTasks,
    productivity: productiveDay.memberProductivity
  } : null;
}


function calculateAggregatedProgressTrend(timelineData) {
  if (timelineData.length < 7) return 0;

  const lastWeek = timelineData.slice(-7);
  const firstProgress = lastWeek[0].totalProgress || 0;
  const lastProgress = lastWeek[lastWeek.length - 1].totalProgress || 0;

  return parseFloat(((lastProgress - firstProgress) / Math.max(1, firstProgress) * 100).toFixed(1));
}

function calculateAverageActiveProjects(timelineData) {
  if (timelineData.length === 0) return 0;

  const total = timelineData.reduce((sum, day) => sum + (day.activeProjects || 0), 0);
  return parseFloat((total / timelineData.length).toFixed(1));
}

function calculateTeamEfficiency(timelineData) {
  if (timelineData.length === 0) return 0;

  const totalCompleted = timelineData.reduce((sum, day) => sum + (day.dailyCompletedTasks || 0), 0);
  const totalActiveMembers = timelineData.reduce((sum, day) => sum + (day.activeMembers || 0), 0);

  if (totalActiveMembers === 0) return 0;

  return parseFloat((totalCompleted / totalActiveMembers).toFixed(1));
}




module.exports = router;

