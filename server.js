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

// Create WebSocket server for real-time data with path filtering
const wss = new WebSocket.Server({
  server,
  path: '/ws/realtime-data' // 明确指定 WebSocket 路径
});

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
  console.log('=== 健康检查请求 ===');
  console.log(`请求来源IP: ${req.ip}`);
  console.log(`User-Agent: ${req.get('User-Agent')}`);
  console.log(`活跃WebSocket连接数: ${streamHandler.getConnectionStats().total}`);
  console.log('=================');
  
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0',
    connections: streamHandler.getConnectionStats().total,
    environment: config.server.env,
    port: config.server.port
  };
  
  res.json(healthData);
});

// Root path - return dashboard interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Analytics API endpoint
app.use('/api/v1/data', (req, res) => {
  // Check for WebSocket upgrade request
  if (req.headers.upgrade === 'websocket') {
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
  // Check for WebSocket upgrade request
  if (req.headers.upgrade === 'websocket') {
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
  // 添加详细的连接诊断日志
  console.log('=== WebSocket 连接诊断 ===');
  console.log(`请求URL: ${req.url}`);
  console.log(`请求头 Upgrade: ${req.headers.upgrade}`);
  console.log(`请求头 Connection: ${req.headers.connection}`);
  console.log(`客户端IP: ${req.ip || req.connection.remoteAddress}`);
  console.log(`User-Agent: ${req.headers['user-agent']}`);
  console.log('=============================');
  
  // Use stream handler to process dashboard connections
  const connectionId = streamHandler.handleChartConnection(ws, req);
  
  console.log(`Analytics client connected: ${connectionId}`);
  
  // 添加 WebSocket 状态监控
  ws.on('close', (code, reason) => {
    console.log(`=== WebSocket 断开诊断 ===`);
    console.log(`连接ID: ${connectionId}`);
    console.log(`断开代码: ${code}`);
    console.log(`断开原因: ${reason}`);
    console.log(`连接持续时间: ${Date.now() - ws.connectTime}ms`);
    console.log('============================');
  });
  
  ws.on('error', (error) => {
    console.log(`=== WebSocket 错误诊断 ===`);
    console.log(`连接ID: ${connectionId}`);
    console.log(`错误详情:`, error);
    console.log('===========================');
  });
  
  // 记录连接时间
  ws.connectTime = Date.now();
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
  console.error('Server error:', err);
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
  console.log(`🚀 Analytics Platform Server Started`);
  console.log(`📍 Address: http://${HOST}:${PORT}`);
  console.log(`🌍 Environment: ${config.server.env}`);
  console.log(`📊 Real-time Data Endpoint: ws://${HOST}:${PORT}/ws/realtime-data`);
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