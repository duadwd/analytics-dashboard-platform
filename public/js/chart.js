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
        const subscriptionMessage = {
            action: 'subscribe',
            channel: 'live-updates',
            timestamp: Date.now()
        };
        socket.send(JSON.stringify(subscriptionMessage));
        console.log('Sent subscription request:', subscriptionMessage);
    };

    socket.onmessage = (event) => {
        console.log('=== 收到服务器消息 ===');
        console.log(`消息大小: ${event.data.length} bytes`);
        console.log(`消息内容: ${event.data}`);
        
        // 尝试解析JSON并检查是否是pong响应
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'pong' && lastPingTime) {
                currentLatency = Date.now() - lastPingTime;
                console.log(`延迟测量: ${currentLatency}ms`);
                updateLatencyDisplay();
            }
        } catch (e) {
            console.log('非JSON消息或解析失败');
        }
        console.log('==================');
    };

    socket.onclose = (event) => {
        const connectionDuration = Date.now() - connectionStartTime;
        console.log('=== WebSocket 连接断开诊断 ===');
        console.log(`断开代码: ${event.code}`);
        console.log(`断开原因: ${event.reason}`);
        console.log(`连接持续时间: ${connectionDuration}ms`);
        console.log(`是否正常关闭: ${event.wasClean}`);
        console.log('============================');
        
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

    // 延迟测量功能
    function startLatencyMeasurement() {
        setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                lastPingTime = Date.now();
                socket.send(JSON.stringify({
                    type: 'ping',
                    timestamp: lastPingTime
                }));
            }
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