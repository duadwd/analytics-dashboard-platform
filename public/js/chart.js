document.addEventListener('DOMContentLoaded', () => {
    const statusIndicator = document.getElementById('status-indicator');
    const canvas = document.getElementById('live-chart');
    const ctx = canvas.getContext('2d');

    // Basic chart placeholder
    ctx.fillStyle = '#f0f2f5';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#aaa';
    ctx.textAlign = 'center';
    ctx.font = '20px Arial';
    ctx.fillText('Waiting for data...', canvas.width / 2, canvas.height / 2);

    // 添加延迟测量变量
    let connectionStartTime = null;
    let lastPingTime = null;
    let currentLatency = -1;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws/realtime-data`;
    
    console.log('=== 前端 WebSocket 连接诊断 ===');
    console.log(`尝试连接URL: ${wsUrl}`);
    console.log(`当前协议: ${window.location.protocol}`);
    console.log(`当前主机: ${window.location.host}`);
    console.log(`当前完整URL: ${window.location.href}`);
    console.log('===============================');
    
    connectionStartTime = Date.now();
    const socket = new WebSocket(wsUrl);

    socket.onopen = () => {
        const connectionTime = Date.now() - connectionStartTime;
        console.log('=== WebSocket 连接成功诊断 ===');
        console.log(`连接建立用时: ${connectionTime}ms`);
        console.log(`WebSocket 状态: ${socket.readyState}`);
        console.log(`WebSocket URL: ${socket.url}`);
        console.log('============================');
        
        statusIndicator.textContent = `Status: Connected (${connectionTime}ms)`;
        statusIndicator.style.color = '#28a745';
        
        // 开始延迟测量
        startLatencyMeasurement();

        // Send a dummy subscription message
        const subscriptionTime = Date.now();
        const subscriptionMessage = {
            action: 'subscribe',
            channel: 'live-updates',
            timestamp: subscriptionTime
        };
        
        console.log('=== 📺 发送订阅请求 ===');
        console.log(`订阅消息:`, subscriptionMessage);
        console.log(`发送前WebSocket状态: ${socket.readyState}`);
        console.log(`发送前缓冲区: ${socket.bufferedAmount} bytes`);
        console.log(`订阅时间: ${subscriptionTime}`);
        
        try {
            socket.send(JSON.stringify(subscriptionMessage));
            console.log('✅ 订阅请求发送成功');
            console.log(`发送后缓冲区: ${socket.bufferedAmount} bytes`);
        } catch (error) {
            console.error('❌ 订阅请求发送失败:', error);
        }
        console.log('======================');
    };

    socket.onmessage = (event) => {
        const messageTime = Date.now();
        console.log('=== 📨 收到服务器消息 ===');
        console.log(`接收时间: ${messageTime}`);
        console.log(`消息大小: ${event.data.length} bytes`);
        console.log(`WebSocket状态: ${socket.readyState}`);
        console.log(`缓冲区大小: ${socket.bufferedAmount} bytes`);
        console.log(`连接持续时间: ${messageTime - connectionStartTime}ms`);
        
        // 尝试解析JSON并检查消息类型
        try {
            const data = JSON.parse(event.data);
            console.log(`消息类型: ${data.type || 'unknown'}`);
            console.log(`消息内容:`, data);
            
            if (data.type === 'pong' && lastPingTime) {
                currentLatency = messageTime - lastPingTime;
                console.log(`🏓 pong响应 - 延迟: ${currentLatency}ms`);
                console.log(`ping时间: ${lastPingTime}, pong时间: ${messageTime}`);
                updateLatencyDisplay();
            } else if (data.type === 'subscription_confirmed') {
                console.log(`✅ 订阅确认收到 - 频道: ${data.channel}`);
                console.log(`确认时间戳: ${data.timestamp}`);
                console.log(`处理延迟: ${messageTime - data.timestamp}ms`);
            } else if (data.type === 'dashboard_update') {
                console.log(`📊 Dashboard数据更新收到`);
                console.log(`数据时间戳: ${data.timestamp}`);
                console.log(`传输延迟: ${messageTime - new Date(data.timestamp).getTime()}ms`);
            }
        } catch (e) {
            console.log('❌ JSON解析失败，可能是二进制数据');
            console.log(`解析错误: ${e.message}`);
        }
        console.log('========================');
    };

    socket.onclose = (event) => {
        const connectionDuration = Date.now() - connectionStartTime;
        console.log('=== 🔌 WebSocket连接断开详细诊断 ===');
        console.log(`🕐 断开时间: ${new Date().toISOString()}`);
        console.log(`⏱️ 连接持续时间: ${connectionDuration}ms`);
        console.log(`🔢 断开代码: ${event.code}`);
        console.log(`📝 断开原因: ${event.reason || '无具体原因'}`);
        console.log(`✅ 是否正常关闭: ${event.wasClean}`);
        console.log(`📊 最后WebSocket状态: ${socket.readyState}`);
        console.log(`📦 最后缓冲区大小: ${socket.bufferedAmount} bytes`);
        
        // 错误代码解释
        const codeExplanations = {
            1000: '正常关闭',
            1001: '端点离开 (Going Away) - 服务器主动关闭',
            1002: '协议错误',
            1003: '不支持的数据类型',
            1005: '无状态码',
            1006: '异常关闭',
            1007: '数据格式错误',
            1008: '违反策略',
            1009: '消息过大',
            1010: '缺少扩展',
            1011: '服务器内部错误'
        };
        
        console.log(`📋 错误代码含义: ${codeExplanations[event.code] || '未知错误'}`);
        
        if (event.code === 1001) {
            console.log('🚨 关键问题：服务器主动关闭连接！');
            console.log('🔍 可能原因：');
            console.log('  - 消息发送频率过高导致服务器负载');
            console.log('  - 定时器冲突导致消息堆积');
            console.log('  - 服务器端错误处理逻辑问题');
            console.log('  - WebSocket缓冲区溢出');
        }
        
        console.log('====================================');
        
        statusIndicator.textContent = `Status: Disconnected (${event.code}) - 持续${connectionDuration}ms`;
        statusIndicator.style.color = '#dc3545';
        currentLatency = -1;
        updateLatencyDisplay();
    };

    socket.onerror = (error) => {
        console.log('=== WebSocket 错误诊断 ===');
        console.log(`错误对象:`, error);
        console.log(`WebSocket 状态: ${socket.readyState}`);
        console.log(`连接URL: ${socket.url}`);
        console.log('========================');
        
        statusIndicator.textContent = 'Status: Connection Error';
        statusIndicator.style.color = '#dc3545';
        currentLatency = -1;
        updateLatencyDisplay();
    };

    // 延迟测量功能 - 增强诊断
    function startLatencyMeasurement() {
        console.log('=== 🔔 启动前端ping定时器 ===');
        console.log(`ping间隔: 5000ms`);
        console.log(`启动时间: ${Date.now()}`);
        console.log('============================');
        
        setInterval(() => {
            console.log('=== ⏰ 前端ping定时器触发 ===');
            console.log(`触发时间: ${Date.now()}`);
            console.log(`WebSocket状态: ${socket.readyState} (1=OPEN)`);
            console.log(`连接开始时间: ${connectionStartTime}`);
            console.log(`连接持续时间: ${Date.now() - connectionStartTime}ms`);
            
            if (socket.readyState === WebSocket.OPEN) {
                lastPingTime = Date.now();
                const pingMessage = {
                    type: 'ping',
                    timestamp: lastPingTime
                };
                
                console.log(`📤 发送ping消息: ${JSON.stringify(pingMessage)}`);
                console.log(`缓冲区状态: ${socket.bufferedAmount} bytes`);
                
                try {
                    socket.send(JSON.stringify(pingMessage));
                    console.log(`✅ ping发送成功`);
                    console.log(`发送后缓冲区: ${socket.bufferedAmount} bytes`);
                } catch (error) {
                    console.error(`❌ ping发送失败:`, error);
                }
            } else {
                console.log(`⚠️ WebSocket未开启，跳过ping发送`);
            }
            console.log('=============================');
        }, 5000); // 每5秒测量一次延迟
    }

    // 更新延迟显示
    function updateLatencyDisplay() {
        const latencyElement = document.getElementById('latency-display');
        if (latencyElement) {
            latencyElement.textContent = currentLatency === -1 ? '-1 ms' : `${currentLatency} ms`;
        } else {
            // 如果页面上没有延迟显示元素，创建一个
            const newElement = document.createElement('div');
            newElement.id = 'latency-display';
            newElement.style.cssText = 'position: fixed; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: white; padding: 5px; border-radius: 3px; font-family: monospace;';
            newElement.textContent = `延迟: ${currentLatency === -1 ? '-1 ms' : currentLatency + ' ms'}`;
            document.body.appendChild(newElement);
        }
    }

    // 初始化延迟显示
    updateLatencyDisplay();
});