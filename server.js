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
    const duration = Date.now() - ws.connectTime;
    console.log(`=== 🔌 服务器端WebSocket断开诊断 ===`);
    console.log(`🆔 连接ID: ${connectionId}`);
    console.log(`🕐 断开时间: ${new Date().toISOString()}`);
    console.log(`⏱️ 连接持续时间: ${duration}ms`);
    console.log(`🔢 断开代码: ${code}`);
    console.log(`📝 断开原因: ${reason || '无原因'}`);
    console.log(`📊 WebSocket最终状态: ${ws.readyState}`);
    console.log(`📦 缓冲区剩余: ${ws.bufferedAmount || 0} bytes`);
    
    // 连接持续时间分析
    if (duration < 3000) {
      console.log(`🚨 短连接警告: 连接仅持续${duration}ms，可能存在问题`);
    }
    
    // 断开代码分析
    const serverCloseReasons = {
      1000: '正常关闭',
      1001: '🚨 服务器主动关闭 - 可能的原因：资源不足、错误处理、消息过载',
      1002: '协议错误',
      1003: '数据类型不支持',
      1005: '无状态码',
      1006: '异常关闭',
      1011: '服务器内部错误'
    };
    
    console.log(`📋 断开原因分析: ${serverCloseReasons[code] || '未知原因'}`);
    
    if (code === 1001) {
      console.log(`🚨 关键问题识别：代码1001表明服务器主动关闭连接`);
      console.log(`🔍 需要检查的服务器端问题：`);
      console.log(`  - 消息发送频率过高`);
      console.log(`  - 定时器任务冲突`);
      console.log(`  - 错误处理逻辑`);
      console.log(`  - 内存或资源限制`);
    }
    
    // 获取连接统计
    const stats = streamHandler.getConnectionStats();
    console.log(`📈 当前连接统计: 总计${stats.total}, 活跃${stats.dashboard}, 流式${stats.streaming}`);
    console.log('=========================================');
  });
  
  ws.on('error', (error) => {
    console.log(`=== ❌ 服务器端WebSocket错误诊断 ===`);
    console.log(`🆔 连接ID: ${connectionId}`);
    console.log(`🕐 错误时间: ${new Date().toISOString()}`);
    console.log(`⏱️ 连接运行时间: ${Date.now() - ws.connectTime}ms`);
    console.log(`📊 WebSocket状态: ${ws.readyState}`);
    console.log(`❌ 错误类型: ${error.name}`);
    console.log(`📝 错误消息: ${error.message}`);
    console.log(`📦 错误代码: ${error.code || '无'}`);
    console.log(`🔍 错误堆栈:`, error.stack);
    console.log('=====================================');
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
  console.log(`=== 🚀 代理服务器启动诊断 ===`);
  console.log(`📍 服务器地址: http://${HOST}:${PORT}`);
  console.log(`🌍 运行环境: ${config.server.env}`);
  console.log(`📊 WebSocket端点: ws://${HOST}:${PORT}/ws/realtime-data`);
  console.log(`🔗 代理端点1: ws://${HOST}:${PORT}/api/v1/data (VLESS兼容)`);
  console.log(`🔗 代理端点2: ws://${HOST}:${PORT}/api/v2/stream (Trojan兼容)`);
  console.log(`🛡️ 伪装功能: 分析仪表板平台`);
  console.log(`🎯 触发机制: 特定数据格式自动切换代理模式`);
  
  // 检查关键配置
  console.log(`=== 🔧 代理配置检查 ===`);
  console.log(`主数据流UUID: ${config.dataSource.primary.apiKey}`);
  console.log(`流数据认证令牌: ${config.dataSource.streaming.token ? '已配置' : '❌未配置'}`);
  console.log(`支持的协议路径:`, config.dataSource.processingPaths);
  console.log(`缓冲区大小: ${config.dataSource.bufferSize} bytes`);
  console.log(`连接超时: ${config.dataSource.timeout}ms`);
  console.log('===============================');
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