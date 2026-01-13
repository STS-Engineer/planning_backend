const cron = require("node-cron");
const pool = require("../db");
const { getNameFromEmail } = require("../utils/getNameFromEmail"); 
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: "avocarbon-com.mail.protection.outlook.com",
  port: 25,
  secure: false,
  auth: {
    user: "administration.STS@avocarbon.com",
    pass: "shnlgdyfbcztbhxn",
  },
});

async function sendMemberWeeklyReminderEmail(to, name) {
  return transporter.sendMail({
    from: '"STS Project Management" <administration.STS@avocarbon.com>',
    to,
    subject: "Weekly reminder: please update your project status",
    html: `
      <p>Dear ${name},</p>
      <p>This is your weekly reminder to update your project/task status for this week.</p>
      <p>Please log in to your dashboard and make sure:</p>
      <ul>
        <li>Your tasks are up to date (To Do / In Progress / Done)</li>
        <li>Task dates (start/end) are correct</li>
        <li>Any blockers are mentioned in task comments</li>
      </ul>
      <p>
        <a href="https://sts-project-management.azurewebsites.net/dashboard" target="_blank">
          Open Dashboard
        </a>
      </p>
      <p>Regards,<br/>STS Project Management Team</p>
    `,
  });
}

async function sendAdminWeeklyReminderEmail(to, name) {
  return transporter.sendMail({
    from: '"STS Project Management" <administration.STS@avocarbon.com>',
    to,
    subject: "Weekly reminder (Admin): follow up on project status updates",
    html: `
      <p>Dear ${name},</p>
      <p>This is your weekly admin reminder to follow up on project status updates.</p>
      <p>Suggested checks:</p>
      <ul>
        <li>Projects with many tasks still in <strong>To Do</strong> or <strong>In Progress</strong></li>
        <li>Unassigned tasks</li>
        <li>Overdue tasks (end date passed)</li>
        <li>Members with no updates this week</li>
      </ul>
      <p>
        <a href="https://sts-project-management.azurewebsites.net/dashboard" target="_blank">
          Open Admin Dashboard
        </a>
      </p>
      <p>Regards,<br/>STS Project Management Team</p>
    `,
  });
}

async function runWeeklyReminders() {
  try {
    // 1) Members
    const membersRes = await pool.query(
      `SELECT id, email FROM "User" WHERE role = $1 AND email IS NOT NULL`,
      ["member"]
    );

    for (const u of membersRes.rows) {
      const name = getNameFromEmail(u.email);
      try {
        await sendMemberWeeklyReminderEmail(u.email, name);
      } catch (e) {
        console.error("Failed member reminder:", u.email, e.message);
      }
    }

    // 2) Admin(s) — adjust role value to what you actually store ('ADMIN' vs 'admin')
    const adminsRes = await pool.query(
      `SELECT id, email FROM "User" WHERE role = $1 AND email IS NOT NULL`,
      ["ADMIN"]
    );

    for (const a of adminsRes.rows) {
      const name = getNameFromEmail(a.email);
      try {
        await sendAdminWeeklyReminderEmail(a.email, name);
      } catch (e) {
        console.error("Failed admin reminder:", a.email, e.message);
      }
    }

    console.log("✅ Weekly reminders sent");
  } catch (err) {
    console.error("❌ Weekly reminder job failed:", err);
  }
}

// Every Friday at 09:00 (Tunis time)
function startWeeklyReminderJob() {
  cron.schedule(
    "0 9 * * 5",
    () => {
      runWeeklyReminders();
    },
    { timezone: "Africa/Tunis" }
  );

  console.log("🕘 Weekly reminder cron scheduled: Fri 09:00 (Africa/Tunis)");
}

module.exports = { startWeeklyReminderJob, runWeeklyReminders };
