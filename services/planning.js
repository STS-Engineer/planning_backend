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


// Helper to get user details for assignee
const getUserDetails = async (userId) => {
  if (!userId) return null;
  
  try {
    const result = await pool.query(
      'SELECT id, email, role FROM "User" WHERE id = $1',
      [userId]
    );
    
    if (result.rows.length === 0) return null;
    
    const user = result.rows[0];
    return {
      id: user.id,
      email: user.email,
      name: getNameFromEmail(user.email),
      role: user.role
    };
  } catch (error) {
    console.error('Error fetching user details:', error);
    return null;
  }
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


// ==================== GLOBAL STATISTICS ====================

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
module.exports = router;
