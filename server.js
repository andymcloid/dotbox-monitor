const express = require('express');
const session = require('express-session');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const helmet = require('helmet');
const compression = require('compression');
const cors = require('cors');
const crypto = require('crypto');
const Database = require('./lib/database');
const HealthCheckService = require('./lib/healthCheck');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Hash function for password tokens (matches client-side)
function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'dotbox_salt_2024').digest('hex');
}

// Simple hash fallback (matches client-side fallback for HTTP)
function simpleHash(str) {
  let hash = 0;
  if (str.length === 0) return hash.toString(16);
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to hex and pad to ensure consistent length
  return Math.abs(hash).toString(16).padStart(8, '0') + 
         Math.abs(hash * 31).toString(16).padStart(8, '0');
}

// Validate auth token (supports both hash types)
function validateAuthToken(token, password) {
  const webCryptoHash = hashPassword(password);
  const simpleHashValue = simpleHash(password + 'dotbox_salt_2024');
  
  return token === webCryptoHash || token === simpleHashValue;
}

// Initialize database and health monitoring
const database = new Database();
let healthCheck;

// Initialize health check after database is ready
database.init().then(async () => {
  healthCheck = new HealthCheckService(database);
  
  // Set up real-time broadcasting callback
  healthCheck.setBroadcastCallback(() => {
    // Light throttle to prevent excessive WebSocket spam (max once per 100ms)
    if (!healthCheck.lastBroadcast || Date.now() - healthCheck.lastBroadcast > 100) {
      healthCheck.lastBroadcast = Date.now();
      broadcastHealthUpdate();
    }
  });
  
  await healthCheck.init();
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

// Middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow inline scripts for Shoelace
  crossOriginOpenerPolicy: false, // Disable for HTTP deployment
  originAgentCluster: false // Disable for HTTP deployment
}));
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dotbox-secret-key',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    secure: false, // Set to true if using HTTPS
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  }
}));

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.status(401).json({ error: 'Authentication required' });
  }
};

// Static files
app.use('/static', express.static(path.join(__dirname, 'public')));
app.use('/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/img', express.static(path.join(__dirname, 'public', 'img')));
app.use('/components', express.static(path.join(__dirname, 'public', 'components')));
app.use('/app.js', express.static(path.join(__dirname, 'public', 'app.js')));

// Routes
app.post('/login', async (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Invalid password' });
  }
});

app.post('/api/login', async (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ message: 'Invalid password' });
  }
});

// Auto-login with stored hash token
app.post('/api/auto-login', async (req, res) => {
  const { authToken } = req.body;
  
  if (!authToken) {
    return res.status(401).json({ message: 'No auth token provided' });
  }
  
  // Verify the token matches our hashed password (supports both hash types)
  if (validateAuthToken(authToken, ADMIN_PASSWORD)) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ message: 'Invalid auth token' });
  }
});

// Session check endpoint
app.get('/api/session-check', (req, res) => {
  if (req.session.authenticated) {
    res.json({ authenticated: true });
  } else {
    res.status(401).json({ authenticated: false });
  }
});

app.post('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ success: true });
  });
});

app.get('/api/status', requireAuth, (req, res) => {
  res.json({ 
    authenticated: true,
    uptime: process.uptime(),
    version: require('./package.json').version
  });
});

app.get('/api/health/overview', requireAuth, (req, res) => {
  if (!healthCheck) {
    return res.status(503).json({ error: 'Health check service not ready' });
  }
  res.json(healthCheck.getOverallHealth());
});

app.get('/api/health/services', requireAuth, (req, res) => {
  if (!healthCheck) {
    return res.status(503).json({ error: 'Health check service not ready' });
  }
  res.json(healthCheck.getAllStatus());
});

app.get('/api/health/categories', requireAuth, (req, res) => {
  if (!healthCheck) {
    return res.status(503).json({ error: 'Health check service not ready' });
  }
  
  // Debug logging
  const categories = healthCheck.getServicesByCategory();
  console.log('DEBUG: /api/health/categories returning:', JSON.stringify(categories, null, 2));
  
  res.json(categories);
});

app.get('/api/health/service/:id', requireAuth, (req, res) => {
  const status = healthCheck.getServiceStatus(req.params.id);
  if (status) {
    res.json(status);
  } else {
    res.status(404).json({ error: 'Service not found' });
  }
});

app.post('/api/health/reload', requireAuth, async (req, res) => {
  try {
    await healthCheck.reloadServices();
    res.json({ success: true, message: 'Services configuration reloaded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Service CRUD operations
app.get('/api/services', requireAuth, async (req, res) => {
  try {
    const services = await database.getAllServices();
    res.json(services);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/services/:id', requireAuth, async (req, res) => {
  try {
    const service = await database.getService(req.params.id);
    if (!service) {
      return res.status(404).json({ error: 'Service not found' });
    }
    res.json(service);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/services', requireAuth, async (req, res) => {
  try {
    const result = await database.createService(req.body);
    await healthCheck.reloadServices();
    broadcastHealthUpdate();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/services/:id', requireAuth, async (req, res) => {
  try {
    const result = await database.updateService(req.params.id, req.body);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    await healthCheck.reloadServices();
    broadcastHealthUpdate();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/services/:id', requireAuth, async (req, res) => {
  try {
    const result = await database.deleteService(req.params.id);
    if (result.changes === 0) {
      return res.status(404).json({ error: 'Service not found' });
    }
    await healthCheck.reloadServices();
    broadcastHealthUpdate();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve main application
app.get('/', (req, res) => {
  if (req.session.authenticated) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.redirect('/login');
  }
});

// Serve login page
app.get('/login', (req, res) => {
  if (req.session.authenticated) {
    res.redirect('/');
  } else {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  }
});

// WebSocket functionality for real-time health updates
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Send initial health status
  if (healthCheck) {
    socket.emit('health-overview', healthCheck.getOverallHealth());
    socket.emit('health-services', healthCheck.getServicesByCategory());
  }

  socket.on('request-health-update', () => {
    if (healthCheck) {
      socket.emit('health-overview', healthCheck.getOverallHealth());
      socket.emit('health-services', healthCheck.getServicesByCategory());
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Broadcast health updates to all connected clients
const broadcastHealthUpdate = async () => {
  if (healthCheck) {
    const healthOverview = healthCheck.getOverallHealth();
    const servicesData = healthCheck.getServicesByCategory();
    
    // Send live status updates only (no chart history - that's fetched via API when needed)
    io.emit('health-overview', healthOverview);
    io.emit('health-services', servicesData);
  }
};

// Fallback broadcast every 30 seconds (real-time updates now handle most cases, this is just backup)
setInterval(broadcastHealthUpdate, 30 * 1000);

// History API endpoints
app.get('/api/services/:id/history', requireAuth, async (req, res) => {
  try {
    const { hours = 24, limit } = req.query;
    const history = await healthCheck.getServiceHistory(req.params.id, parseInt(hours), limit ? parseInt(limit) : null);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/services/:id/graphdata', requireAuth, async (req, res) => {
  try {
    const { hours = 24, maxPoints = 100 } = req.query;
    const graphData = await healthCheck.getServiceGraphData(req.params.id, parseInt(hours), parseInt(maxPoints));
    res.json(graphData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/history', requireAuth, async (req, res) => {
  try {
    const { hours = 24, limit = 1000 } = req.query;
    const history = await healthCheck.getAllServicesHistory(parseInt(hours), parseInt(limit));
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings API endpoints
app.get('/api/settings', requireAuth, async (req, res) => {
  try {
    const settings = await database.getAllSettings();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/settings/:key', requireAuth, async (req, res) => {
  try {
    const value = await database.getSetting(req.params.key);
    if (value === null) {
      return res.status(404).json({ error: 'Setting not found' });
    }
    res.json({ key: req.params.key, value });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings/:key', requireAuth, async (req, res) => {
  try {
    const { value, description } = req.body;
    if (!value) {
      return res.status(400).json({ error: 'Value is required' });
    }
    const result = await database.setSetting(req.params.key, value, description);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual cleanup endpoint
app.post('/api/history/cleanup', requireAuth, async (req, res) => {
  try {
    await database.cleanupOldHistory();
    res.json({ success: true, message: 'History cleanup completed' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add debug endpoint
app.get('/api/debug', requireAuth, async (req, res) => {
  try {
    const services = await database.getAllServices();
    const healthOverview = healthCheck ? healthCheck.getOverallHealth() : null;
    const healthCategories = healthCheck ? healthCheck.getServicesByCategory() : null;
    const allStatus = healthCheck ? healthCheck.getAllStatus() : null;
    const settings = await database.getAllSettings();
    
    res.json({
      database_services: services,
      health_overview: healthOverview,
      health_categories: healthCategories,
      all_status: allStatus,
      settings: settings,
      services_count: services.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`Dotbox Monitor running on port ${PORT}`);
}); 