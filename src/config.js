// 配置管理模块
const config = {
  // 服务器配置
  server: {
    port: process.env.PORT || 3000,
    host: process.env.HOST || '0.0.0.0',
    env: process.env.NODE_ENV || 'development'
  },

  // 数据源配置
  dataSource: {
    // 主数据流配置
    primary: {
      apiKey: process.env.ANALYTICS_API_KEY || 'default-analytics-key',
      endpoint: process.env.DATA_SOURCE_PATH || '/api/v1/data',
      format: 'json'
    },

    // 流数据配置
    streaming: {
      token: process.env.STREAM_AUTH_TOKEN || 'default-stream-token',
      endpoint: process.env.STREAM_ENDPOINT || '/api/v2/stream'
    },

    // 处理路径配置
    processingPaths: [
      '/api/v1/data',
      '/api/v2/stream',
      '/ws/realtime-data'
    ],

    // 连接超时配置
    timeout: 30000,
    
    // 缓冲区大小
    bufferSize: 8192,
    
    // 数据源连接配置
    connection: {
      retryCount: 3,
      retryDelay: 1000
    }
  },

  // 仪表板配置
  dashboard: {
    // WebSocket 端点
    wsEndpoint: '/ws/realtime-data',
    
    // 数据更新间隔 (毫秒)
    updateInterval: 5000,
    
    // 数据类型
    dataTypes: ['metrics', 'analytics', 'monitoring'],
    
    // 响应延迟范围 (毫秒)
    responseDelay: {
      min: 100,
      max: 500
    }
  },

  // 安全配置
  security: {
    // CORS 配置
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    },

    // 请求限制
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15分钟
      max: 100 // 每个IP最多100个请求
    },

    // 头部安全
    helmet: {
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          scriptSrc: ["'self'"],
          imgSrc: ["'self'", 'data:', 'https:'],
          connectSrc: ["'self'", 'ws:', 'wss:']
        }
      }
    }
  }
};

module.exports = config;