const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const nodemailer = require('nodemailer');

// ... your existing middleware and configurations ...

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
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>New Project Assignment</title>
    <style>
        /* Simple Reset */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f7fa;
            padding: 20px;
        }
        
        /* Main Container */
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            overflow: hidden;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.08);
        }
        
        /* Header */
        .header {
            background: #4f46e5;
            color: white;
            padding: 32px 40px;
            text-align: center;
        }
        
        .header-icon {
            font-size: 48px;
            margin-bottom: 16px;
            display: block;
        }
        
        .header-title {
            font-size: 24px;
            font-weight: 600;
            margin-bottom: 8px;
        }
        
        .header-subtitle {
            font-size: 14px;
            opacity: 0.9;
        }
        
        /* Content */
        .content {
            padding: 40px;
        }
        
        .greeting {
            font-size: 16px;
            color: #4b5563;
            margin-bottom: 24px;
        }
        
        .greeting strong {
            color: #111827;
        }
        
        /* Project Card */
        .project-card {
            background: white;
            border: 1px solid #e5e7eb;
            border-radius: 8px;
            padding: 32px;
            margin: 32px 0;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
        }
        
        .card-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 24px;
            padding-bottom: 16px;
            border-bottom: 1px solid #f3f4f6;
        }
        
        .card-icon {
            width: 48px;
            height: 48px;
            background: #f0f9ff;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            color: #4f46e5;
        }
        
        .card-title {
            font-size: 20px;
            font-weight: 600;
            color: #111827;
        }
        
        .card-subtitle {
            font-size: 14px;
            color: #6b7280;
        }
        
        /* Details List */
        .details-list {
            display: grid;
            gap: 16px;
        }
        
        .detail-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 12px 0;
        }
        
        .detail-icon {
            width: 32px;
            height: 32px;
            background: #f8fafc;
            border-radius: 6px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #4f46e5;
            flex-shrink: 0;
        }
        
        .detail-content {
            flex: 1;
        }
        
        .detail-label {
            font-size: 13px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 500;
            margin-bottom: 2px;
        }
        
        .detail-value {
            font-size: 16px;
            color: #111827;
            font-weight: 500;
        }
        
        /* Timeline */
        .timeline {
            display: flex;
            align-items: center;
            justify-content: space-between;
            margin: 32px 0;
            padding: 24px;
            background: #f9fafb;
            border-radius: 8px;
        }
        
        .timeline-item {
            text-align: center;
            flex: 1;
        }
        
        .timeline-label {
            font-size: 12px;
            color: #6b7280;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
        }
        
        .timeline-date {
            font-size: 16px;
            color: #111827;
            font-weight: 600;
        }
        
        .timeline-separator {
            color: #d1d5db;
            font-size: 20px;
            padding: 0 16px;
        }
        
        /* CTA Button */
        .cta-section {
            text-align: center;
            margin: 40px 0 32px;
        }
        
        .cta-button {
            display: inline-block;
            background: #4f46e5;
            color: white;
            text-decoration: none;
            padding: 16px 32px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            transition: background 0.2s;
        }
        
        .cta-button:hover {
            background: #4338ca;
        }
        
        .cta-note {
            font-size: 14px;
            color: #6b7280;
            margin-top: 12px;
        }
        
        /* Footer */
        .footer {
            border-top: 1px solid #e5e7eb;
            padding: 32px 40px;
            text-align: center;
            background: #f9fafb;
        }
        
        .footer-logo {
            font-size: 18px;
            font-weight: 700;
            color: #4f46e5;
            margin-bottom: 8px;
        }
        
        .footer-info {
            font-size: 13px;
            color: #6b7280;
            line-height: 1.5;
        }
        
        /* Responsive */
        @media (max-width: 640px) {
            .header,
            .content {
                padding: 24px;
            }
            
            .project-card {
                padding: 24px;
            }
            
            .timeline {
                flex-direction: column;
                gap: 16px;
            }
            
            .timeline-separator {
                transform: rotate(90deg);
                padding: 8px 0;
            }
            
            .footer {
                padding: 24px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <!-- Header -->
        <div class="header">
            <span class="header-icon">🎯</span>
            <h1 class="header-title">New Project Assignment</h1>
            <p class="header-subtitle">STS Project Management System</p>
        </div>
        
        <!-- Content -->
        <div class="content">
            <p class="greeting">
                Dear <strong>${name}</strong>,
            </p>
            
            <p style="color: #4b5563; margin-bottom: 24px;">
                You have been assigned to a new project. Here are the details:
            </p>
            
            <!-- Project Card -->
            <div class="project-card">
                <div class="card-header">
                    <div class="card-icon">📋</div>
                    <div>
                        <h2 class="card-title">${projectName}</h2>
                        <p class="card-subtitle">New Project Assignment</p>
                    </div>
                </div>
                
                <!-- Details List -->
                <div class="details-list">
                    <div class="detail-item">
                        <div class="detail-icon">🏷️</div>
                        <div class="detail-content">
                            <div class="detail-label">Project Name</div>
                            <div class="detail-value">${projectName}</div>
                        </div>
                    </div>
                    
                    ${startDate ? `
                    <div class="detail-item">
                        <div class="detail-icon">📅</div>
                        <div class="detail-content">
                            <div class="detail-label">Start Date</div>
                            <div class="detail-value">${startDate}</div>
                        </div>
                    </div>
                    ` : ''}
                    
                    ${endDate ? `
                    <div class="detail-item">
                        <div class="detail-icon">🎯</div>
                        <div class="detail-content">
                            <div class="detail-label">End Date</div>
                            <div class="detail-value">${endDate}</div>
                        </div>
                    </div>
                    ` : ''}
                </div>
                
                <!-- Timeline -->
                ${startDate && endDate ? `
                <div class="timeline">
                    <div class="timeline-item">
                        <div class="timeline-label">Starts</div>
                        <div class="timeline-date">${startDate}</div>
                    </div>
                    <div class="timeline-separator">→</div>
                    <div class="timeline-item">
                        <div class="timeline-label">Ends</div>
                        <div class="timeline-date">${endDate}</div>
                    </div>
                </div>
                ` : ''}
            </div>
            
            <!-- Call to Action -->
            <div class="cta-section">
                <a href="https://sts-project-management.azurewebsites.net/dashboard" class="cta-button" target="_blank">
                    View Project Details
                </a>
                <p class="cta-note">
                    Access your dashboard for complete project information
                </p>
            </div>
            
            <div style="color: #4b5563; font-size: 15px; line-height: 1.6;">
                <p style="margin-bottom: 8px;">
                    <strong>📌 What to do next:</strong>
                </p>
                <ul style="padding-left: 20px; color: #6b7280;">
                    <li style="margin-bottom: 4px;">Review the project details in your dashboard</li>
                    <li style="margin-bottom: 4px;">Check your assigned tasks and deadlines</li>
                    <li>Contact your project lead for any questions</li>
                </ul>
            </div>
        </div>
        
        <!-- Footer -->
        <div class="footer">
            <div class="footer-logo">STS Project Management</div>
            <div class="footer-info">
                <p>This is an automated notification. Please do not reply to this email.</p>
                <p style="margin-top: 8px;">
                    For assistance, contact your project lead or system administrator.
                </p>
            </div>
        </div>
    </div>
</body>
</html>
`
    });
  } catch (err) {
    console.error('Failed to send email:', err);
  }
};
// ==================== Notifications ENDPOINTS ====================
// Helper function to create notifications
const createNotification = async (userId, title, message, type, referenceType = null, referenceId = null) => {
  try {
    const result = await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_type, reference_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, title, message, type, referenceType, referenceId]
    );

    console.log(`Notification created for user ${userId}: ${title}`);
    return result.rows[0];
  } catch (error) {
    console.error('Error creating notification:', error);
    return null;
  }
};

// Helper to notify project members
const notifyProjectMembers = async (projectId, title, message, type, excludeUserId = null) => {
  try {
    // Get all project members
    const membersResult = await pool.query(
      `SELECT user_id FROM project_members WHERE project_id = $1`,
      [projectId]
    );

    // Also include project creator
    const creatorResult = await pool.query(
      `SELECT user_id FROM projects WHERE project_id = $1`,
      [projectId]
    );

    const allUserIds = new Set([
      ...membersResult.rows.map(row => row.user_id),
      creatorResult.rows[0]?.user_id
    ]);

    // Remove excluded user if specified
    if (excludeUserId) {
      allUserIds.delete(excludeUserId);
    }

    // Create notifications for each user
    const notifications = [];
    for (const userId of allUserIds) {
      const notification = await createNotification(
        userId,
        title,
        message,
        type,
        'project',
        projectId
      );
      if (notification) notifications.push(notification);
    }

    console.log(`Created ${notifications.length} notifications for project ${projectId}`);
    return notifications;
  } catch (error) {
    console.error('Error notifying project members:', error);
    return [];
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

    // 3️⃣ Create notification for creator
    await createNotification(
      creatorId,
      'Project Created',
      `You created a new project: "${project_name}"`,
      'success',
      'project',
      projectId
    );

    // 4️⃣ Notify assigned members
    for (const memberId of members) {
      await createNotification(
        memberId,
        'Added to Project',
        `You have been added to project: "${project_name}"`,
        'assignment',
        'project',
        projectId
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

// update project
router.put('/projects/:projectId', authenticate, async (req, res) => {
  const client = await pool.connect();

  try {
    const { projectId } = req.params;
    const {
      project_name,
      start_date,
      end_date,
      comment,
      members = []
    } = req.body;

    await client.query('BEGIN');

    // 1️⃣ Update project
    await client.query(
      `
      UPDATE projects
      SET
        "project-name" = $1,
        "start-date" = $2,
        "end-date" = $3,
        comment = $4
      WHERE project_id = $5
      `,
      [project_name, start_date, end_date, comment, projectId]
    );

    // 2️⃣ Remove unselected members
    await client.query(
      `
      DELETE FROM project_members
      WHERE project_id = $1
      AND user_id NOT IN (
        SELECT UNNEST($2::int[])
      )
      `,
      [projectId, members.length ? members : [0]]
    );

    // 3️⃣ Add new members
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

    // 4️⃣ Fetch emails of project members
    const { rows: users } = await pool.query(
      `
      SELECT email
      FROM "User"
      WHERE id = ANY($1::int[])
      `,
      [members]
    );

    // 5️⃣ Send emails with CC to Taha
    const emailPromises = users.map(user =>
      transporter.sendMail({
        from: '"AVO Carbon" <administration.STS@avocarbon.com>',
        to: user.email,
        subject: `🚀 Project Updated: ${project_name}`,
        html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Project Update - AVO Carbon</title>
        <style>
          /* Modern CSS Reset */
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            margin: 0;
            padding: 20px;
            min-height: 100vh;
          }

          .email-container {
            max-width: 600px;
            margin: 40px auto;
            background: white;
            border-radius: 24px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
            overflow: hidden;
            position: relative;
          }

          /* Decorative elements */
          .email-container::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            height: 6px;
            background: linear-gradient(90deg, #667eea, #764ba2, #f093fb);
          }

          /* Header */
          .email-header {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 40px 30px;
            text-align: center;
            border-bottom: 1px solid #e0e0e0;
          }

          .logo-container {
            margin-bottom: 20px;
          }

          .logo {
            font-size: 32px;
            font-weight: bold;
            background: linear-gradient(90deg, #667eea, #764ba2);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            display: inline-block;
          }

          .header-title {
            font-size: 28px;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 10px;
            background: linear-gradient(90deg, #2d3748, #4a5568);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
          }

          .header-subtitle {
            color: #718096;
            font-size: 16px;
            font-weight: 500;
          }

          /* Badge */
          .update-badge {
            display: inline-block;
            background: linear-gradient(135deg, #667eea, #764ba2);
            color: white;
            padding: 8px 20px;
            border-radius: 50px;
            font-size: 14px;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-top: 15px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
          }

          /* Content */
          .email-content {
            padding: 40px 30px;
          }

          .greeting {
            font-size: 18px;
            color: #2d3748;
            margin-bottom: 30px;
            font-weight: 500;
          }

          .greeting strong {
            color: #667eea;
            font-weight: 700;
          }

          /* Project Card */
          .project-card {
            background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
            border-radius: 20px;
            padding: 30px;
            margin: 30px 0;
            border: 1px solid #e2e8f0;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            position: relative;
            overflow: hidden;
          }

          .project-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            width: 8px;
            height: 100%;
            background: linear-gradient(180deg, #667eea, #764ba2);
          }

          .project-title {
            font-size: 24px;
            font-weight: 700;
            color: #2d3748;
            margin-bottom: 20px;
            padding-left: 15px;
            position: relative;
          }

          .project-title::before {
            content: '📋';
            position: absolute;
            left: -10px;
          }

          /* Details Grid */
          .details-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-top: 25px;
          }

          .detail-item {
            background: white;
            padding: 20px;
            border-radius: 16px;
            border: 1px solid #edf2f7;
            transition: all 0.3s ease;
          }

          .detail-item:hover {
            transform: translateY(-5px);
            box-shadow: 0 15px 30px rgba(0, 0, 0, 0.08);
            border-color: #cbd5e0;
          }

          .detail-label {
            font-size: 12px;
            text-transform: uppercase;
            color: #718096;
            font-weight: 600;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
            display: flex;
            align-items: center;
            gap: 8px;
          }

          .detail-label::before {
            content: '';
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
          }

          .detail-value {
            font-size: 16px;
            font-weight: 600;
            color: #2d3748;
            line-height: 1.4;
          }

          /* Action Button */
          .action-section {
            text-align: center;
            margin: 40px 0 30px;
          }

          .action-button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-decoration: none;
            padding: 18px 40px;
            border-radius: 50px;
            font-weight: 700;
            font-size: 16px;
            letter-spacing: 0.5px;
            transition: all 0.3s ease;
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
            position: relative;
            overflow: hidden;
          }

          .action-button:hover {
            transform: translateY(-3px);
            box-shadow: 0 15px 35px rgba(102, 126, 234, 0.4);
          }

          .action-button::after {
            content: '→';
            margin-left: 10px;
            transition: transform 0.3s ease;
          }

          .action-button:hover::after {
            transform: translateX(5px);
          }

          /* Timeline */
          .timeline {
            margin: 30px 0;
            position: relative;
          }

          .timeline::before {
            content: '';
            position: absolute;
            left: 20px;
            top: 0;
            bottom: 0;
            width: 2px;
            background: linear-gradient(180deg, #667eea, #764ba2);
          }

          .timeline-item {
            display: flex;
            align-items: center;
            margin-bottom: 25px;
            position: relative;
          }

          .timeline-dot {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            background: linear-gradient(135deg, #667eea, #764ba2);
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 18px;
            margin-right: 20px;
            flex-shrink: 0;
            z-index: 1;
            box-shadow: 0 5px 15px rgba(102, 126, 234, 0.3);
          }

          .timeline-content {
            flex: 1;
            padding: 15px;
            background: #f8f9fa;
            border-radius: 12px;
            border-left: 4px solid #667eea;
          }

          /* Footer */
          .email-footer {
            background: #1a202c;
            color: white;
            padding: 40px 30px;
            text-align: center;
            border-top: 1px solid #2d3748;
          }

          .footer-logo {
            font-size: 24px;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 20px;
          }

          .footer-links {
            margin: 25px 0;
          }

          .footer-link {
            color: #cbd5e0;
            text-decoration: none;
            margin: 0 15px;
            font-size: 14px;
            transition: color 0.3s ease;
          }

          .footer-link:hover {
            color: #667eea;
          }

          .copyright {
            font-size: 12px;
            color: #718096;
            margin-top: 25px;
            line-height: 1.6;
          }

          /* Responsive */
          @media (max-width: 600px) {
            .email-container {
              margin: 20px auto;
              border-radius: 16px;
            }

            .email-header,
            .email-content {
              padding: 30px 20px;
            }

            .header-title {
              font-size: 24px;
            }

            .project-card {
              padding: 20px;
            }

            .details-grid {
              grid-template-columns: 1fr;
            }

            .action-button {
              padding: 16px 32px;
              width: 100%;
              text-align: center;
            }
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <!-- Header -->
          <div class="email-header">
            <div class="logo-container">
              <div class="logo">AVO CARBON</div>
            </div>
            <h1 class="header-title">Project Update Notification</h1>
            <p class="header-subtitle">STS Project Management System</p>
      
          </div>

          <!-- Content -->
          <div class="email-content">
            <p class="greeting">
              Hello <strong>${getNameFromEmail(user.email)}</strong>,
            </p>
            
            <p style="color: #4a5568; margin-bottom: 30px; font-size: 16px;">
              We wanted to inform you that there have been updates to a project you're associated with.
            </p>

            <!-- Project Card -->
            <div class="project-card">
              <h2 class="project-title">${project_name}</h2>
              
              <!-- Timeline -->
              <div class="timeline">
                ${start_date ? `
                <div class="timeline-item">
                  <div class="timeline-dot">📅</div>
                  <div class="timeline-content">
                    <strong>Start Date:</strong> ${start_date}
                  </div>
                </div>
                ` : ''}
                
                ${end_date ? `
                <div class="timeline-item">
                  <div class="timeline-dot">🎯</div>
                  <div class="timeline-content">
                    <strong>End Date:</strong> ${end_date}
                  </div>
                </div>
                ` : ''}
              </div>

              <!-- Details Grid -->
              <div class="details-grid">
                <div class="detail-item">
                  <div class="detail-label">Project Name</div>
                  <div class="detail-value">${project_name}</div>
                </div>

                ${start_date ? `
                <div class="detail-item">
                  <div class="detail-label">Start Date</div>
                  <div class="detail-value">${start_date}</div>
                </div>
                ` : ''}

                ${end_date ? `
                <div class="detail-item">
                  <div class="detail-label">End Date</div>
                  <div class="detail-value">${end_date}</div>
                </div>
                ` : ''}

                <div class="detail-item">
                  <div class="detail-label">Notes</div>
                  <div class="detail-value">${comment || 'No additional notes'}</div>
                </div>
              </div>
            </div>

       

            <p style="color: #4a5568; font-size: 15px; line-height: 1.6;">
              The project details have been updated in the STS Project Management System. 
              You can review the changes and collaborate with your team members.
            </p>
          </div>

          <!-- Footer -->
          <div class="email-footer">
            <div class="footer-logo">AVO CARBON</div>
            <p style="color: #cbd5e0; margin-bottom: 20px;">
              Sustainable Technology Solutions
            </p>
            
            <div class="footer-links">
              <a href="#" class="footer-link">Dashboard</a>
              <a href="#" class="footer-link">Projects</a>
              <a href="#" class="footer-link">Support</a>
              <a href="#" class="footer-link">Contact</a>
            </div>
            
            <div class="copyright">
              <p>© ${new Date().getFullYear()} AVO Carbon. All rights reserved.</p>
              <p>This email was automatically generated by STS Project Management System.</p>
              <p style="margin-top: 15px; color: #4a5568;">
                Need help? Contact us at <a href="mailto:support@avocarbon.com" style="color: #667eea;">support@avocarbon.com</a>
              </p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `
      })
    );

    await Promise.all(emailPromises);

    console.log(`✅ Project updated and ${emailPromises.length} emails sent with CC to Taha`);

    await notifyProjectMembers(
      projectId,
      'Project Updated',
      `Project "${project_name}" has been updated.`,
      'info',
      req.user.userId // Exclude the user who made the update
    );
    res.json({
      message: 'Project updated and emails sent successfully',
      emailsSent: emailPromises.length,
      ccRecipient: 'taha.khiari@avocarbon.com'
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Failed to update project' });
  } finally {
    client.release();
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

     // Create notification for task creator
    await createNotification(
      req.user.userId,
      'Task Created',
      `You created a new task: "${task_name}"`,
      'success',
      'task',
      result.rows[0].task_id
    );

    // Notify assignee if assigned
    if (parsedAssigneeId && parsedAssigneeId !== req.user.userId) {
      await createNotification(
        parsedAssigneeId,
        'Task Assigned',
        `You have been assigned to task: "${task_name}"`,
        'assignment',
        'task',
        result.rows[0].task_id
      );
    }

    // Notify other project members
    await notifyProjectMembers(
      project_id,
      'New Task Created',
      `A new task "${task_name}" was added to the project.`,
      'task',
      req.user.userId
    );

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

     // Notify new assignee
    if (parsedAssigneeId && parsedAssigneeId !== req.user.userId) {
      await createNotification(
        parsedAssigneeId,
        'Task Assigned',
        `You have been assigned to task: "${taskName}"`,
        'assignment',
        'task',
        id
      );
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




//notifications endpoints 
// ==================== NOTIFICATION ENDPOINTS ====================

// Get user notifications
router.get('/notifications', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT 50`,
      [userId]
    );

    res.json({ notifications: result.rows });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get unread notification count
router.get('/notifications/unread-count', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query(
      `SELECT COUNT(*) FROM notifications 
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({ count: parseInt(result.rows[0].count) });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Failed to fetch unread count' });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const result = await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    res.json({ notification: result.rows[0] });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.patch('/notifications/mark-all-read', authenticate, async (req, res) => {
  try {
    const userId = req.user.userId;

    await pool.query(
      `UPDATE notifications 
       SET is_read = TRUE, read_at = CURRENT_TIMESTAMP
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Delete notification
router.delete('/notifications/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    await pool.query(
      'DELETE FROM notifications WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({ message: 'Notification deleted successfully' });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
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

