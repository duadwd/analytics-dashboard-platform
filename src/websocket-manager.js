const net = require('net');
const { Transform } = require('stream');
const config = require('./config');
const DataProcessor = require('./data-processor');
const DecoyDataGenerator = require('./decoy-data-generator');

/**
 * WebSocket Manager - Implements real-time analytics data streaming
 * Responsible for handling WebSocket connections and managing data flows
 */
class StreamHandler {
  constructor() {
    this.config = config;
    this.dataProcessor = new DataProcessor();
    this.dashboardGenerator = new DecoyDataGenerator();
    this.activeConnections = new Map();
    this.dataConnections = new Map();
  }

  /**
   * Handle dashboard connections (main WebSocket handling function)
   * @param {WebSocket} ws - WebSocket connection object
   * @param {Object} req - Request object
   * @returns {string} Connection ID
   */
  handleChartConnection(ws, req) {
    const connectionId = this.generateConnectionId();
    const connectionInfo = {
      id: connectionId,
      ws,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent'],
      connectedAt: new Date().toISOString(),
      isDataStream: false,
      stage: 'dashboard', // 'dashboard' | 'detected' | 'streaming'
      buffer: Buffer.alloc(0),
      targetConnection: null
    };

    this.activeConnections.set(connectionId, connectionInfo);
    
    console.log(`=== WebSocket Manager 连接处理 ===`);
    console.log(`连接ID: ${connectionId}`);
    console.log(`客户端IP: ${connectionInfo.ip}`);
    console.log(`WebSocket 状态: ${ws.readyState}`);
    console.log(`请求URL: ${req.url}`);
    console.log(`活跃连接数: ${this.activeConnections.size}`);
    console.log(`New analytics connection established: ${connectionId} (${connectionInfo.ip})`);
    console.log('=================================');
    
    // Start sending dashboard data
    this.startDashboardDataSending(connectionId);
    
    // 设置消息处理器
    ws.on('message', (data) => {
      this.handleConnectionMessage(connectionId, data);
    });
    
    // 设置关闭处理器
    ws.on('close', () => {
      this.closeConnection(connectionId);
    });
    
    ws.on('error', (error) => {
      console.error(`连接错误 ${connectionId}:`, error);
      this.closeConnection(connectionId);
    });
    
    return connectionId;
  }

  /**
   * Start sending dashboard data
   * @param {string} connectionId - Connection ID
   */
  startDashboardDataSending(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection || connection.stage !== 'dashboard') {
      return;
    }

    // Send initial dashboard data
    this.sendDashboardData(connectionId);
    
    // Set periodic sending
    connection.dashboardInterval = setInterval(() => {
      if (connection.stage === 'dashboard' && connection.ws.readyState === 1) {
        this.sendDashboardData(connectionId);
      } else {
        clearInterval(connection.dashboardInterval);
      }
    }, this.config.dashboard.updateInterval);
  }

  /**
   * Send dashboard data
   * @param {string} connectionId - Connection ID
   */
  sendDashboardData(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection || connection.ws.readyState !== 1) {
      return;
    }

    try {
      const dashboardData = this.dashboardGenerator.generateDashboardData();
      const message = JSON.stringify({
        type: 'dashboard_update',
        data: dashboardData,
        timestamp: new Date().toISOString()
      });
      
      connection.ws.send(message);
    } catch (error) {
      console.error(`Dashboard data sending failed ${connectionId}:`, error);
    }
  }

  /**
   * Handle connection messages
   * @param {string} connectionId - Connection ID
   * @param {Buffer|string} data - Received data
   */
  handleConnectionMessage(connectionId, data) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return;
    }

    console.log(`=== 收到客户端消息 ===`);
    console.log(`连接ID: ${connectionId}`);
    console.log(`消息大小: ${data.length} bytes`);
    console.log(`连接阶段: ${connection.stage}`);

    // 首先尝试解析JSON消息（如ping/pong、订阅消息等）
    try {
      const message = JSON.parse(data.toString());
      console.log(`JSON消息类型: ${message.type || 'unknown'}`);
      console.log(`JSON消息内容:`, message);

      // 处理ping消息
      if (message.type === 'ping') {
        const pongMessage = {
          type: 'pong',
          timestamp: message.timestamp,
          serverTime: Date.now()
        };
        connection.ws.send(JSON.stringify(pongMessage));
        console.log(`发送pong响应: ${JSON.stringify(pongMessage)}`);
        console.log('====================');
        return;
      }

      // 处理订阅消息
      if (message.action === 'subscribe') {
        console.log(`处理订阅请求: ${message.channel}`);
        const response = {
          type: 'subscription_confirmed',
          channel: message.channel,
          timestamp: Date.now()
        };
        connection.ws.send(JSON.stringify(response));
        console.log(`发送订阅确认: ${JSON.stringify(response)}`);
        console.log('====================');
        return;
      }
    } catch (e) {
      console.log(`非JSON消息，尝试二进制处理: ${e.message}`);
    }

    // Convert data to Buffer for binary processing
    const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
    
    if (connection.stage === 'dashboard') {
      // In dashboard mode, detect if data stream format
      this.detectDataFormat(connectionId, buffer);
    } else if (connection.stage === 'streaming') {
      // In streaming mode, forward data to target server
      this.forwardDataToTarget(connectionId, buffer);
    }
    console.log('====================');
  }

  /**
   * Detect data format
   * @param {string} connectionId - Connection ID
   * @param {Buffer} data - Data buffer
   */
  detectDataFormat(connectionId, data) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return;
    }

    // Add new data to buffer
    connection.buffer = Buffer.concat([connection.buffer, data]);

    // Try to parse data format
    const parseResult = this.dataProcessor.parseDataPacket(connection.buffer);
    
    if (parseResult.success) {
      console.log(`Processing data stream: ${parseResult.format} (${connectionId})`);
      
      // Stop sending dashboard data
      if (connection.dashboardInterval) {
        clearInterval(connection.dashboardInterval);
        connection.dashboardInterval = null;
      }
      
      // Switch to streaming mode
      connection.stage = 'detected';
      connection.isDataStream = true;
      connection.formatInfo = parseResult;
      
      // Establish connection to data source
      this.establishDataConnection(connectionId, parseResult);
    } else if (connection.buffer.length > this.config.dataSource.bufferSize) {
      // Buffer too large, clear and continue dashboard mode
      connection.buffer = Buffer.alloc(0);
      console.log(`Buffer cleared, continuing dashboard mode: ${connectionId}`);
    }
  }

  /**
   * Establish connection to data source
   * @param {string} connectionId - Connection ID
   * @param {Object} formatInfo - Data format information
   */
  establishDataConnection(connectionId, formatInfo) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return;
    }

    const { target } = formatInfo;
    console.log(`Connecting to data source: ${target.address}:${target.port} (${connectionId})`);

    // Create TCP connection to data source
    const targetSocket = net.createConnection({
      host: target.address,
      port: target.port,
      timeout: this.config.dataSource.timeout
    });

    targetSocket.on('connect', () => {
      console.log(`Data source connection established: ${target.address}:${target.port} (${connectionId})`);
      
      connection.stage = 'streaming';
      connection.targetConnection = targetSocket;
      
      // Send format response
      this.sendFormatResponse(connectionId, formatInfo);
      
      // If there's payload data, forward to data source
      if (formatInfo.payload && formatInfo.payload.length > 0) {
        targetSocket.write(formatInfo.payload);
      }
      
      // Setup data source handling
      this.setupDataSourceHandling(connectionId, targetSocket);
    });

    targetSocket.on('error', (error) => {
      console.error(`Data source connection error ${connectionId}:`, error);
      this.closeConnection(connectionId);
    });

    targetSocket.on('close', () => {
      console.log(`Data source connection closed: ${connectionId}`);
      this.closeConnection(connectionId);
    });

    targetSocket.on('timeout', () => {
      console.log(`Data source connection timeout: ${connectionId}`);
      targetSocket.destroy();
      this.closeConnection(connectionId);
    });
  }

  /**
   * Send format response
   * @param {string} connectionId - Connection ID
   * @param {Object} formatInfo - Format information
   */
  sendFormatResponse(connectionId, formatInfo) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection || connection.ws.readyState !== 1) {
      return;
    }

    try {
      const response = this.dataProcessor.createResponse(formatInfo.format, formatInfo);
      if (response && response.length > 0) {
        connection.ws.send(response);
      }
    } catch (error) {
      console.error(`Format response sending failed ${connectionId}:`, error);
    }
  }

  /**
   * Setup data source handling
   * @param {string} connectionId - Connection ID
   * @param {net.Socket} targetSocket - Target socket
   */
  setupDataSourceHandling(connectionId, targetSocket) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return;
    }

    // Receive data from data source and forward to client
    targetSocket.on('data', (data) => {
      if (connection.ws.readyState === 1) {
        connection.ws.send(data);
      }
    });
  }

  /**
   * Forward data to data source
   * @param {string} connectionId - Connection ID
   * @param {Buffer} data - Data to forward
   */
  forwardDataToTarget(connectionId, data) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection || !connection.targetConnection) {
      return;
    }

    try {
      connection.targetConnection.write(data);
    } catch (error) {
      console.error(`Data forwarding failed ${connectionId}:`, error);
      this.closeConnection(connectionId);
    }
  }

  /**
   * Close connection
   * @param {string} connectionId - Connection ID
   * @returns {boolean} Whether successfully closed
   */
  closeConnection(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      return false;
    }

    try {
      // Clean up timers
      if (connection.dashboardInterval) {
        clearInterval(connection.dashboardInterval);
      }

      // Close target connection
      if (connection.targetConnection) {
        connection.targetConnection.destroy();
      }

      // Close WebSocket connection
      if (connection.ws.readyState === 1) {
        connection.ws.close();
      }

      // Remove from active connections
      this.activeConnections.delete(connectionId);
      
      console.log(`Connection closed: ${connectionId}`);
      return true;
    } catch (error) {
      console.error('Connection close failed:', error);
      return false;
    }
  }

  /**
   * Generate connection ID
   * @returns {string} Connection ID
   */
  generateConnectionId() {
    return `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get active connection statistics
   * @returns {Object} Connection statistics
   */
  getConnectionStats() {
    const stats = {
      total: this.activeConnections.size,
      dataStream: 0,
      dashboard: 0,
      streaming: 0,
      connections: []
    };

    for (const [connectionId, connection] of this.activeConnections) {
      if (connection.isDataStream) {
        stats.dataStream++;
      }
      
      if (connection.stage === 'dashboard') {
        stats.dashboard++;
      } else if (connection.stage === 'streaming') {
        stats.streaming++;
      }

      stats.connections.push({
        id: connectionId,
        ip: connection.ip,
        isDataStream: connection.isDataStream,
        stage: connection.stage,
        connectedAt: connection.connectedAt,
        format: connection.formatInfo?.format || null,
        target: connection.formatInfo?.target || null
      });
    }

    return stats;
  }

  /**
   * 处理WebSocket连接（保持向后兼容）
   * @param {WebSocket} ws - WebSocket 连接对象
   * @param {Object} req - 请求对象
   * @returns {string} 连接ID
   */
  handleWebSocketConnection(ws, req) {
    return this.handleChartConnection(ws, req);
  }
}

module.exports = StreamHandler;