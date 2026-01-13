const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const dotenv = require('dotenv');
const http = require('http');
const path = require('path');

dotenv.config();

const app = express();
const server = http.createServer(app);

// Routers & Jobs
const prodformrouter = require('./services/planning');
const { startWeeklyReminderJob } = require('./jobs/weeklyReminders');

/* =========================================================
   CORS CONFIGURATION (MUST BE FIRST)
========================================================= */

const corsOptions = {
  origin: 'https://sts-project-management.azurewebsites.net',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json());

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/* =========================================================
   ROUTES
========================================================= */

app.use('/ajouter', prodformrouter);

/* =========================================================
   HEALTH CHECK (OPTIONAL BUT RECOMMENDED)
========================================================= */

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK' });
});

/* =========================================================
   START JOBS
========================================================= */

startWeeklyReminderJob();

/* =========================================================
   SERVER START
========================================================= */

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
