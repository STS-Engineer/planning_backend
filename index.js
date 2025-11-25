const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
require('dotenv').config();
const http = require('http');
const path = require('path');
const app = express();
const server = http.createServer(app);
const prodformrouter = require('./services/planning');



// ✅ CORS config FIRST
app.use(cors({
  origin: 'http://localhost:3000',  // frontend domain
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));



// Middleware
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));
app.use(express.json());

// Routes
app.use('/ajouter', prodformrouter);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));



const PORT = 4000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
