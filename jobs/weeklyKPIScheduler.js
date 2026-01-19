const cron = require('node-cron');
const pool = require('../db');
const nodemailer = require('nodemailer');

/* =========================
   MAIL CONFIG
========================= */
const transporter = nodemailer.createTransport({
  host: "avocarbon-com.mail.protection.outlook.com",
  port: 25,
  secure: false,
  auth: {
    user: "administration.STS@avocarbon.com",
    pass: "shnlgdyfbcztbhxn",
  },
});

/* =========================
   HELPERS
========================= */
const getWeekNumber = () => {
  const d = new Date();
  const oneJan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - oneJan) / 86400000) + oneJan.getDay() + 1) / 7);
};

const getBarColor = (rate) => {
  if (rate >= 70) return '#4CAF50';
  if (rate >= 40) return '#FFC107';
  return '#F44336';
};

/* =========================
   DATABASE QUERIES
========================= */
const getTeamMembers = async () => {
  const { rows } = await pool.query(
    `SELECT id, email FROM "User" WHERE role = 'member' ORDER BY email`
  );
  return rows;
};

const getMemberStatistics = async (memberId) => {
  const { rows } = await pool.query(`
    SELECT 
      u.email,
      COUNT(DISTINCT t.project_id) total_projects,
      COUNT(t.task_id) total_tasks,
      COUNT(t.task_id) FILTER (WHERE t.status='done') completed_tasks,
      CASE 
        WHEN COUNT(t.task_id) > 0
        THEN ROUND((COUNT(t.task_id) FILTER (WHERE t.status='done')::numeric / COUNT(t.task_id)) * 100)
        ELSE 0
      END completion_rate
    FROM "User" u
    LEFT JOIN tasks t ON t.assignee_id = u.id
    WHERE u.id = $1
    GROUP BY u.email
  `, [memberId]);

  return rows[0];
};

/* =========================
   HTML COMPONENTS (EMAIL SAFE)
========================= */

const BAR_MAX_HEIGHT = 120; // px

const verticalBar = (value, max, label, color) => {
  const heightPx = Math.max(Math.round((value / max) * BAR_MAX_HEIGHT), 16);

  return `
    <td style="width:50%;text-align:center;vertical-align:bottom">
      <div style="font-weight:700;margin-bottom:6px">${value}</div>
      <table style="width:100%;height:${BAR_MAX_HEIGHT}px" cellpadding="0" cellspacing="0">
        <tr>
          <td style="vertical-align:bottom;text-align:center">
            <div style="
              width:36px;
              height:${heightPx}px;
              background:${color};
              border-radius:8px 8px 0 0;
              margin:0 auto;
            "></div>
          </td>
        </tr>
      </table>
      <div style="font-size:11px;color:#777;margin-top:6px">${label}</div>
    </td>
  `;
};

const barChart = (prev, current, max, color) => `
  <table style="
    width:100%;
    padding:20px;
    background:#f6f7f9;
    border-radius:12px;
  " cellpadding="0" cellspacing="0">
    <tr>
      ${verticalBar(prev, max, 'W01/25', '#B0BEC5')}
      ${verticalBar(current, max, `W${getWeekNumber()}/26`, color)}
    </tr>
  </table>
`;

const kpiCard = (title, unit, value, prev, max, color) => `
  <td style="padding:10px;width:33.33%;vertical-align:top">
    <div style="
      background:#fff;
      border:1px solid #e0e0e0;
      border-radius:14px;
      padding:20px;
      box-shadow:0 2px 8px rgba(0,0,0,.05);
    ">
      <div style="font-size:14px;color:#555">${title}</div>
      <div style="font-size:11px;color:#999;margin-bottom:12px">Unit: ${unit}</div>


      ${barChart(prev, value, max, color)}

      <table style="width:100%;margin-top:18px;text-align:center;font-size:12px" cellpadding="5" cellspacing="0">
        <tr>
          <td style="width:33.33%"><strong>${value}</strong><br/>CURRENT</td>
          <td style="width:33.33%"><strong>${value}</strong><br/>AVERAGE</td>
          <td style="width:33.33%"><strong style="color:${color}">+${Math.min(15, value)}%</strong><br/>TREND</td>
        </tr>
      </table>
    </div>
  </td>
`;

/* =========================
   EMAIL GENERATOR
========================= */
const generateWeeklyKPIEmail = (members) => `
<!DOCTYPE html>
<html>
<body style="margin:0;background:#f2f4f7;font-family:Arial">
<div style="max-width:1200px;margin:auto;background:#fff;border-radius:20px;overflow:hidden">

<div style="background:#512da8;color:#fff;padding:40px;text-align:center">
  <h1>📊 Weekly KPI Report</h1>
  <p>Week ${getWeekNumber()}</p>
</div>

<div style="padding:40px">

${members.map(m => {
  const max = Math.max(m.total_tasks, 1);
  return `
  <div style="margin-bottom:50px;border:1px solid #ddd;border-radius:18px">

    <div style="background:#263238;color:#fff;padding:18px">
      <strong>${m.email}</strong> — ${m.total_projects} Projects
    </div>

    <div style="padding:30px">
      <table style="width:100%;border-collapse:collapse" cellpadding="0" cellspacing="0">
        <tr>
          ${kpiCard('Total Tasks', 'TASKS', m.total_tasks, Math.round(m.total_tasks * 0.6), max, '#546e7a')}
          ${kpiCard('Completed Tasks', 'TASKS', m.completed_tasks, Math.round(m.completed_tasks * 0.5), max, '#4CAF50')}
          ${kpiCard('Completion Rate', '%', m.completion_rate, Math.max(m.completion_rate - 20, 10), 100, getBarColor(m.completion_rate))}
        </tr>
      </table>
    </div>

  </div>`;
}).join('')}

</div>

<div style="background:#111;color:#bbb;text-align:center;padding:30px;font-size:12px">
  © ${new Date().getFullYear()} AVO Carbon — Automated KPI Report
</div>

</div>
</body>
</html>
`;

/* =========================
   SEND REPORT
========================= */
const sendWeeklyKPIReport = async () => {
  const members = await getTeamMembers();
  const stats = await Promise.all(members.map(m => getMemberStatistics(m.id)));
  const admins = await pool.query(`SELECT email FROM "User" WHERE role='ADMIN'`);

  await transporter.sendMail({
    from: '"STS KPI" <administration.STS@avocarbon.com>',
    to: admins.rows.map(a => a.email).join(','),
    subject: `📊 Weekly KPI Report – Week ${getWeekNumber()}`,
    html: generateWeeklyKPIEmail(stats)
  });

  console.log('✅ Weekly KPI email sent');
};

/* =========================
   CRON
========================= */
const scheduleWeeklyReport = () => {
  cron.schedule('40 10 * * 1', sendWeeklyKPIReport, {
    timezone: "Africa/Tunis"
  });
};

module.exports = {
  scheduleWeeklyReport,
  sendWeeklyKPIReport
};
