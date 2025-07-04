const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const config = require('./src/config');
const StreamHandler = require('./src/websocket-manager');
const DataProcessor = require('./src/data-processor');

// Create Express application
const app = express();
const server = http.createServer(app);

// Create core analytics processors
const streamHandler = new StreamHandler();
const dataProcessor = new DataProcessor();

// Create WebSocket server for real-time data
const wss = new WebSocket.Server({ server });

// Middleware configuration
app.use(helmet(config.security.helmet));
app.use(cors(config.security.cors));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use(express.static(path.join(__dirname, 'public')));

// Health check endpoint
app.get('/health', (req, res) => {
  console.log(`[HTTP] Received request for ${req.method} ${req.url}`);
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// Root path - return dashboard interface
app.get('/', (req, res) => {
  console.log(`[HTTP] Received request for ${req.method} ${req.url}`);
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Analytics API endpoint
app.use('/api/v1/data', (req, res) => {
  console.log(`[HTTP] Received request for ${req.method} ${req.url}`);
  // Check for WebSocket upgrade request
  if (req.headers.upgrade === 'websocket') {
    console.log(`[HTTP] WebSocket upgrade request detected for ${req.url}`);
    // WebSocket upgrade handled by wss
    return;
  }
  
  // Regular HTTP request returns analytics data
  const mockData = {
    timestamp: new Date().toISOString(),
    metrics: {
      cpu: Math.random() * 100,
      memory: Math.random() * 100,
      disk: Math.random() * 100
    },
    analytics: {
      visitors: Math.floor(Math.random() * 1000),
      pageViews: Math.floor(Math.random() * 5000),
      bounceRate: Math.random() * 0.5
    }
  };
  
  res.json(mockData);
});

// Real-time streaming API endpoint
app.use('/api/v2/stream', (req, res) => {
  console.log(`[HTTP] Received request for ${req.method} ${req.url}`);
  // Check for WebSocket upgrade request
  if (req.headers.upgrade === 'websocket') {
    console.log(`[HTTP] WebSocket upgrade request detected for ${req.url}`);
    // WebSocket upgrade handled by wss
    return;
  }
  
  // Regular HTTP request returns SSE stream
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  
  let counter = 0;
  const interval = setInterval(() => {
    const data = {
      id: counter++,
      timestamp: new Date().toISOString(),
      value: Math.random() * 1000
    };
    
    res.write(`data: ${JSON.stringify(data)}\n\n`);
    
    if (counter > 10) {
      clearInterval(interval);
      res.end();
    }
  }, 1000);
  
  req.on('close', () => {
    clearInterval(interval);
  });
});

// WebSocket connection handling for real-time analytics
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] New client connection attempt from ${clientIp}. Upgrading to WebSocket...`);
  // Use stream handler to process dashboard connections
  const connectionId = streamHandler.handleChartConnection(ws, req);
  
  console.log(`[WebSocket] Successfully established connection: ${connectionId}`);
});

// Connection statistics endpoint
app.get('/api/connections/stats', (req, res) => {
  const stats = streamHandler.getConnectionStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

// Data processing statistics endpoint
app.get('/api/processor/stats', (req, res) => {
  const stats = dataProcessor.getProtocolStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR] Unhandled server error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
  });
  res.status(500).json({
    error: 'Internal server error',
    message: config.server.env === 'development' ? err.message : 'An unexpected error occurred'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: 'Resource not found',
    path: req.path
  });
});

// Start analytics server
const PORT = config.server.port;
const HOST = config.server.host;

server.listen(PORT, HOST, () => {
  console.log(`[Server] 🚀 Analytics Platform Server Started Successfully`);
  console.log(`[Server] Listening on: http://${HOST}:${PORT}`);
  console.log(`[Server] Environment: ${config.server.env}`);
  console.log(`[Server] Real-time Data Endpoint: ws://${HOST}:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM signal, starting graceful shutdown...');
  server.close(() => {
    console.log('Analytics server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT signal, starting graceful shutdown...');
  server.close(() => {
    console.log('Analytics server closed');
    process.exit(0);
  });
});

module.exports = app;