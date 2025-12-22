const express = require('express');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const path = require('path');

const prodformrouter = require('./services/planning');

const app = express();
const server = http.createServer(app);

const corsOptions = {
  origin: 'https://sts-project-management.azurewebsites.net',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
};

// ✅ Apply CORS globally
app.use(cors(corsOptions));

// ✅ Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ✅ Routes
app.use('/ajouter', prodformrouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Optional test route
app.get('/test', (req, res) => res.send('Server is running!'));

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
