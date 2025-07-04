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

    console.log(`=== 🚀 开始Dashboard数据发送 ===`);
    console.log(`连接ID: ${connectionId}`);
    console.log(`WebSocket状态: ${connection.ws.readyState}`);
    console.log(`更新间隔: ${this.config.dashboard.updateInterval}ms`);
    console.log(`当前时间: ${Date.now()}`);
    console.log('===============================');

    // 延迟发送初始数据，避免与订阅确认冲突
    setTimeout(() => {
      console.log(`=== 📤 发送初始Dashboard数据 ===`);
      console.log(`连接ID: ${connectionId}`);
      console.log(`延迟时间: 1000ms`);
      console.log(`当前时间: ${Date.now()}`);
      this.sendDashboardData(connectionId);
      console.log('==============================');
    }, 1000);
    
    // Set periodic sending
    connection.dashboardInterval = setInterval(() => {
      console.log(`=== ⏰ 定时器触发Dashboard发送 ===`);
      console.log(`连接ID: ${connectionId}`);
      console.log(`WebSocket状态: ${connection.ws.readyState}`);
      console.log(`连接阶段: ${connection.stage}`);
      console.log(`当前时间: ${Date.now()}`);
      
      if (connection.stage === 'dashboard' && connection.ws.readyState === 1) {
        this.sendDashboardData(connectionId);
      } else {
        console.log(`⚠️ 清理定时器 - 状态: ${connection.stage}, WebSocket: ${connection.ws.readyState}`);
        clearInterval(connection.dashboardInterval);
      }
      console.log('================================');
    }, this.config.dashboard.updateInterval);
    
    // 记录定时器创建
    console.log(`✅ Dashboard定时器已创建 (间隔: ${this.config.dashboard.updateInterval}ms)`);
  }

  /**
   * Send dashboard data
   * @param {string} connectionId - Connection ID
   */
  sendDashboardData(connectionId) {
    const connection = this.activeConnections.get(connectionId);
    
    console.log(`=== 📊 Dashboard数据发送检查 ===`);
    console.log(`连接ID: ${connectionId}`);
    console.log(`连接存在: ${!!connection}`);
    
    if (!connection) {
      console.log(`❌ 连接不存在，跳过发送`);
      console.log('==============================');
      return;
    }
    
    console.log(`WebSocket状态: ${connection.ws.readyState} (1=OPEN)`);
    console.log(`连接阶段: ${connection.stage}`);
    console.log(`发送前时间戳: ${Date.now()}`);
    
    if (connection.ws.readyState !== 1) {
      console.log(`❌ WebSocket未开启，跳过发送`);
      console.log('==============================');
      return;
    }

    try {
      const beforeSend = Date.now();
      const dashboardData = this.dashboardGenerator.generateDashboardData();
      const message = JSON.stringify({
        type: 'dashboard_update',
        data: dashboardData,
        timestamp: new Date().toISOString()
      });
      
      console.log(`消息大小: ${message.length} bytes`);
      console.log(`消息类型: dashboard_update`);
      
      // 检查WebSocket缓冲区
      if (connection.ws.bufferedAmount > 0) {
        console.log(`⚠️ WebSocket缓冲区有数据: ${connection.ws.bufferedAmount} bytes`);
      }
      
      connection.ws.send(message);
      const afterSend = Date.now();
      
      console.log(`✅ Dashboard数据发送成功`);
      console.log(`发送耗时: ${afterSend - beforeSend}ms`);
      console.log(`发送后缓冲区: ${connection.ws.bufferedAmount} bytes`);
      console.log(`发送后WebSocket状态: ${connection.ws.readyState}`);
      
    } catch (error) {
      console.error(`❌ Dashboard数据发送失败 ${connectionId}:`, error);
      console.error(`错误类型: ${error.name}`);
      console.error(`错误消息: ${error.message}`);
      console.error(`错误堆栈:`, error.stack);
    }
    console.log('==============================');
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
        const beforePong = Date.now();
        console.log(`🏓 收到ping消息，准备发送pong`);
        console.log(`ping时间戳: ${message.timestamp}`);
        console.log(`WebSocket缓冲区: ${connection.ws.bufferedAmount} bytes`);
        
        const pongMessage = {
          type: 'pong',
          timestamp: message.timestamp,
          serverTime: beforePong
        };
        
        try {
          connection.ws.send(JSON.stringify(pongMessage));
          const afterPong = Date.now();
          console.log(`✅ pong发送成功: ${JSON.stringify(pongMessage)}`);
          console.log(`pong发送耗时: ${afterPong - beforePong}ms`);
          console.log(`发送后缓冲区: ${connection.ws.bufferedAmount} bytes`);
          console.log(`发送后WebSocket状态: ${connection.ws.readyState}`);
        } catch (error) {
          console.error(`❌ pong发送失败:`, error);
        }
        console.log('====================');
        return;
      }

      // 处理订阅消息
      if (message.action === 'subscribe') {
        const beforeSubscription = Date.now();
        console.log(`📺 处理订阅请求: ${message.channel}`);
        console.log(`订阅前WebSocket状态: ${connection.ws.readyState}`);
        console.log(`订阅前缓冲区: ${connection.ws.bufferedAmount} bytes`);
        
        const response = {
          type: 'subscription_confirmed',
          channel: message.channel,
          timestamp: beforeSubscription
        };
        
        try {
          connection.ws.send(JSON.stringify(response));
          const afterSubscription = Date.now();
          console.log(`✅ 订阅确认发送成功: ${JSON.stringify(response)}`);
          console.log(`订阅确认发送耗时: ${afterSubscription - beforeSubscription}ms`);
          console.log(`发送后缓冲区: ${connection.ws.bufferedAmount} bytes`);
          console.log(`发送后WebSocket状态: ${connection.ws.readyState}`);
          
          // 🚨 关键诊断：检查订阅确认后是否会立即触发其他操作
          console.log(`⚠️ 订阅确认发送完成，连接状态检查:`);
          console.log(`- 连接阶段: ${connection.stage}`);
          console.log(`- Dashboard定时器存在: ${!!connection.dashboardInterval}`);
          console.log(`- 将要开始Dashboard数据流...`);
          
        } catch (error) {
          console.error(`❌ 订阅确认发送失败:`, error);
        }
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

    console.log(`=== 🔍 代理数据格式检测 ===`);
    console.log(`连接ID: ${connectionId}`);
    console.log(`接收数据大小: ${data.length} bytes`);
    console.log(`当前缓冲区大小: ${connection.buffer.length} bytes`);
    console.log(`数据前16字节 (hex): ${data.slice(0, 16).toString('hex')}`);
    console.log(`数据前16字节 (ascii): ${data.slice(0, 16).toString('ascii').replace(/[^\x20-\x7E]/g, '.')}`);

    // Add new data to buffer
    connection.buffer = Buffer.concat([connection.buffer, data]);
    console.log(`合并后缓冲区大小: ${connection.buffer.length} bytes`);

    // Try to parse data format
    const parseResult = this.dataProcessor.parseDataPacket(connection.buffer);
    
    console.log(`🔬 协议解析结果:`, parseResult);
    
    if (parseResult.success) {
      console.log(`🚀 检测到代理协议: ${parseResult.format} (${connectionId})`);
      console.log(`🎯 目标地址: ${parseResult.target?.address}:${parseResult.target?.port}`);
      console.log(`📊 载荷大小: ${parseResult.payload?.length || 0} bytes`);
      
      // Stop sending dashboard data
      if (connection.dashboardInterval) {
        console.log(`⏹️ 停止仪表板数据发送定时器`);
        clearInterval(connection.dashboardInterval);
        connection.dashboardInterval = null;
      }
      
      // Switch to streaming mode
      connection.stage = 'detected';
      connection.isDataStream = true;
      connection.formatInfo = parseResult;
      
      console.log(`🔄 连接模式切换: dashboard -> detected`);
      
      // Establish connection to data source
      this.establishDataConnection(connectionId, parseResult);
    } else {
      console.log(`❌ 协议解析失败: ${parseResult.error || '未知格式'}`);
      if (connection.buffer.length > this.config.dataSource.bufferSize) {
        // Buffer too large, clear and continue dashboard mode
        console.log(`🗑️ 缓冲区过大，清空并继续仪表板模式`);
        connection.buffer = Buffer.alloc(0);
        console.log(`Buffer cleared, continuing dashboard mode: ${connectionId}`);
      }
    }
    console.log('===============================');
  }

  /**
   * Establish connection to data source
   * @param {string} connectionId - Connection ID
   * @param {Object} formatInfo - Data format information
   */
  establishDataConnection(connectionId, formatInfo) {
    const connection = this.activeConnections.get(connectionId);
    if (!connection) {
      console.error(`❌ 建立代理连接失败: 连接 ${connectionId} 不存在`);
      return;
    }

    const { target } = formatInfo;
    console.log(`=== 🌐 建立代理目标连接 ===`);
    console.log(`连接ID: ${connectionId}`);
    console.log(`目标地址: ${target.address}`);
    console.log(`目标端口: ${target.port}`);
    console.log(`目标类型: ${target.type}`);
    console.log(`超时设置: ${this.config.dataSource.timeout}ms`);
    console.log(`载荷数据: ${formatInfo.payload?.length || 0} bytes`);

    // Create TCP connection to data source
    const targetSocket = net.createConnection({
      host: target.address,
      port: target.port,
      timeout: this.config.dataSource.timeout
    });

    console.log(`🔌 正在连接到 ${target.address}:${target.port}...`);

    targetSocket.on('connect', () => {
      console.log(`=== ✅ 代理目标连接成功 ===`);
      console.log(`目标地址: ${target.address}:${target.port}`);
      console.log(`连接ID: ${connectionId}`);
      console.log(`本地地址: ${targetSocket.localAddress}:${targetSocket.localPort}`);
      console.log(`远程地址: ${targetSocket.remoteAddress}:${targetSocket.remotePort}`);
      
      connection.stage = 'streaming';
      connection.targetConnection = targetSocket;
      
      console.log(`🔄 连接模式切换: detected -> streaming`);
      
      // Send format response
      console.log(`📤 发送协议响应...`);
      this.sendFormatResponse(connectionId, formatInfo);
      
      // If there's payload data, forward to data source
      if (formatInfo.payload && formatInfo.payload.length > 0) {
        console.log(`📦 转发载荷数据: ${formatInfo.payload.length} bytes`);
        try {
          targetSocket.write(formatInfo.payload);
          console.log(`✅ 载荷数据转发成功`);
        } catch (error) {
          console.error(`❌ 载荷数据转发失败:`, error);
        }
      }
      
      // Setup data source handling
      console.log(`🔗 设置数据转发处理器...`);
      this.setupDataSourceHandling(connectionId, targetSocket);
      console.log('===============================');
    });

    targetSocket.on('error', (error) => {
      console.error(`=== ❌ 代理目标连接错误 ===`);
      console.error(`连接ID: ${connectionId}`);
      console.error(`目标地址: ${target.address}:${target.port}`);
      console.error(`错误类型: ${error.name}`);
      console.error(`错误消息: ${error.message}`);
      console.error(`错误代码: ${error.code || '无'}`);
      console.error(`系统错误号: ${error.errno || '无'}`);
      console.error('=============================');
      this.closeConnection(connectionId);
    });

    targetSocket.on('close', () => {
      console.log(`=== 🔌 代理目标连接关闭 ===`);
      console.log(`连接ID: ${connectionId}`);
      console.log(`目标地址: ${target.address}:${target.port}`);
      console.log(`关闭时间: ${new Date().toISOString()}`);
      console.log('============================');
      this.closeConnection(connectionId);
    });

    targetSocket.on('timeout', () => {
      console.log(`=== ⏰ 代理目标连接超时 ===`);
      console.log(`连接ID: ${connectionId}`);
      console.log(`目标地址: ${target.address}:${target.port}`);
      console.log(`超时时间: ${this.config.dataSource.timeout}ms`);
      console.log('============================');
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