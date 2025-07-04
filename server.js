const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const url = require('url'); // 引入URL模块
const config = require('./src/config');
const StreamHandler = require('./src/websocket-manager');
const DataProcessor = require('./src/data-processor');

// 定义代理WebSocket的特定路径
const PROXY_WEBSOCKET_PATH = '/ws/realtime-data';

// 创建 Express 应用和 HTTP 服务器
const app = express();
const server = http.createServer(app);

// 创建核心分析处理器
const streamHandler = new StreamHandler();
const dataProcessor = new DataProcessor();

// 创建 WebSocket 服务器，但不立即附加到HTTP服务器
// noServer: true 允许我们手动处理升级请求
const wss = new WebSocket.Server({ noServer: true });

// 中间件配置
app.use(helmet(config.security.helmet));
app.use(cors(config.security.cors));
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 健康检查端点
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: '1.0.0'
  });
});

// 根路径 - 返回仪表盘界面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 连接统计端点
app.get('/api/connections/stats', (req, res) => {
  const stats = streamHandler.getConnectionStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

// 数据处理统计端点
app.get('/api/processor/stats', (req, res) => {
  const stats = dataProcessor.getProtocolStats();
  res.json({
    success: true,
    data: stats,
    timestamp: new Date().toISOString()
  });
});

// 手动处理 WebSocket 升级请求
server.on('upgrade', (request, socket, head) => {
  console.log(`[Server] Received WebSocket upgrade request for URL: ${request.url}`);
  const { pathname } = new URL(request.url, `http://${request.headers.host}`);
  
  if (pathname === PROXY_WEBSOCKET_PATH) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  } else {
    console.log(`[Server] WebSocket upgrade rejected for path: ${pathname}`);
    socket.destroy();
  }
});

// WebSocket 连接处理逻辑
wss.on('connection', (ws, req) => {
  const clientIp = req.socket.remoteAddress;
  console.log(`[WebSocket] New client connection from ${clientIp} for path ${req.url}`);
  
  // 使用 streamHandler 处理已验证的图表连接
  const connectionId = streamHandler.handleChartConnection(ws, req);
  console.log(`[WebSocket] Successfully established connection: ${connectionId}`);
});


// 错误处理中间件
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

// 404 处理器
app.use((req, res) => {
  res.status(404).json({
    error: 'Resource not found',
    path: req.path
  });
});

// 启动分析服务器
const PORT = config.server.port;
const HOST = config.server.host;

server.listen(PORT, HOST, () => {
  console.log(`[Server] 🚀 Analytics Platform Server Started Successfully`);
  console.log(`[Server] Listening on: http://${HOST}:${PORT}`);
  console.log(`[Server] Environment: ${config.server.env}`);
  console.log(`[Server] Real-time Data Endpoint: ws://${HOST}:${PORT}${PROXY_WEBSOCKET_PATH}`);
});

// 优雅关机
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