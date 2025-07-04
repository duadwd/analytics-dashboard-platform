const config = require('./config');

/**
 * Business Data Generator
 * Responsible for generating realistic analytics and monitoring data for dashboards
 */
class DecoyDataGenerator {
  constructor() {
    this.config = config;
    this.dataHistory = {
      metrics: [],
      analytics: [],
      monitoring: []
    };
    this.startTime = Date.now();
  }

  /**
   * Generate real-time system metrics
   * @returns {Object} Metrics data object
   */
  generateMetrics() {
    const now = new Date();
    const timeOffset = now.getTime() - this.startTime;
    
    // Generate cyclical data patterns simulating real system metrics
    const cpuUsage = 30 + 40 * Math.sin(timeOffset / 60000) + Math.random() * 20;
    const memoryUsage = 45 + 25 * Math.cos(timeOffset / 45000) + Math.random() * 15;
    const diskUsage = 60 + 20 * Math.sin(timeOffset / 120000) + Math.random() * 10;
    const networkIn = Math.max(0, 100 + 200 * Math.sin(timeOffset / 30000) + Math.random() * 50);
    const networkOut = Math.max(0, 80 + 150 * Math.cos(timeOffset / 35000) + Math.random() * 40);

    const metrics = {
      timestamp: now.toISOString(),
      cpu: Math.max(0, Math.min(100, cpuUsage)),
      memory: Math.max(0, Math.min(100, memoryUsage)),
      disk: Math.max(0, Math.min(100, diskUsage)),
      network: {
        inbound: Math.round(networkIn * 100) / 100,
        outbound: Math.round(networkOut * 100) / 100
      },
      processes: Math.floor(Math.random() * 50) + 120,
      uptime: Math.floor(timeOffset / 1000)
    };

    // Store historical data (keep max 100 entries)
    this.dataHistory.metrics.push(metrics);
    if (this.dataHistory.metrics.length > 100) {
      this.dataHistory.metrics.shift();
    }

    return metrics;
  }

  /**
   * Generate business analytics data
   * @returns {Object} Analytics data object
   */
  generateAnalytics() {
    const now = new Date();
    const hour = now.getHours();
    const dayOfWeek = now.getDay();
    
    // Generate realistic website analytics based on time patterns
    let baseVisitors = 100;
    if (hour >= 9 && hour <= 17) {
      baseVisitors *= 3; // Business hours traffic increase
    }
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      baseVisitors *= 0.6; // Weekend traffic reduction
    }

    const visitors = Math.floor(baseVisitors + Math.random() * 50);
    const pageViews = Math.floor(visitors * (2 + Math.random() * 3));
    const bounceRate = 0.3 + Math.random() * 0.4;
    const avgSessionDuration = 120 + Math.random() * 300; // 2-7 minutes

    const analytics = {
      timestamp: now.toISOString(),
      visitors: {
        current: visitors,
        today: Math.floor(visitors * 24 * (0.8 + Math.random() * 0.4)),
        thisWeek: Math.floor(visitors * 24 * 7 * (0.9 + Math.random() * 0.2))
      },
      pageViews: {
        current: pageViews,
        today: Math.floor(pageViews * 24 * (0.8 + Math.random() * 0.4)),
        popular: this.generatePopularPages()
      },
      bounceRate: Math.round(bounceRate * 100) / 100,
      avgSessionDuration: Math.round(avgSessionDuration),
      topCountries: this.generateTopCountries(),
      topBrowsers: this.generateTopBrowsers(),
      conversions: {
        rate: Math.round((0.02 + Math.random() * 0.08) * 100) / 100,
        total: Math.floor(visitors * (0.02 + Math.random() * 0.08))
      }
    };

    // Store historical data
    this.dataHistory.analytics.push(analytics);
    if (this.dataHistory.analytics.length > 100) {
      this.dataHistory.analytics.shift();
    }

    return analytics;
  }

  /**
   * Generate system monitoring data
   * @returns {Object} Monitoring data object
   */
  generateMonitoring() {
    const now = new Date();
    
    const monitoring = {
      timestamp: now.toISOString(),
      services: [
        {
          name: 'Web Server',
          status: Math.random() > 0.05 ? 'healthy' : 'warning',
          responseTime: 50 + Math.random() * 200,
          uptime: 99.9 - Math.random() * 0.5
        },
        {
          name: 'Database',
          status: Math.random() > 0.02 ? 'healthy' : 'critical',
          responseTime: 20 + Math.random() * 80,
          uptime: 99.95 - Math.random() * 0.3
        },
        {
          name: 'Cache Server',
          status: Math.random() > 0.03 ? 'healthy' : 'warning',
          responseTime: 5 + Math.random() * 15,
          uptime: 99.8 - Math.random() * 0.8
        },
        {
          name: 'CDN',
          status: 'healthy',
          responseTime: 30 + Math.random() * 50,
          uptime: 99.99
        }
      ],
      alerts: this.generateAlerts(),
      performance: {
        throughput: Math.floor(1000 + Math.random() * 2000),
        errorRate: Math.round((Math.random() * 0.05) * 100) / 100,
        latency: {
          p50: 45 + Math.random() * 30,
          p95: 120 + Math.random() * 80,
          p99: 250 + Math.random() * 150
        }
      }
    };

    // 保存历史数据
    this.dataHistory.monitoring.push(monitoring);
    if (this.dataHistory.monitoring.length > 100) {
      this.dataHistory.monitoring.shift();
    }

    return monitoring;
  }

  /**
   * 生成热门页面数据
   * @returns {Array} 热门页面列表
   */
  generatePopularPages() {
    const pages = [
      { path: '/', views: Math.floor(Math.random() * 1000) + 500 },
      { path: '/dashboard', views: Math.floor(Math.random() * 800) + 300 },
      { path: '/analytics', views: Math.floor(Math.random() * 600) + 200 },
      { path: '/reports', views: Math.floor(Math.random() * 400) + 150 },
      { path: '/settings', views: Math.floor(Math.random() * 200) + 50 }
    ];
    
    return pages.sort((a, b) => b.views - a.views);
  }

  /**
   * 生成顶级国家数据
   * @returns {Array} 国家访问统计
   */
  generateTopCountries() {
    const countries = [
      { name: 'United States', visitors: Math.floor(Math.random() * 300) + 200, flag: '🇺🇸' },
      { name: 'China', visitors: Math.floor(Math.random() * 250) + 150, flag: '🇨🇳' },
      { name: 'Germany', visitors: Math.floor(Math.random() * 200) + 100, flag: '🇩🇪' },
      { name: 'United Kingdom', visitors: Math.floor(Math.random() * 180) + 80, flag: '🇬🇧' },
      { name: 'Japan', visitors: Math.floor(Math.random() * 150) + 60, flag: '🇯🇵' }
    ];
    
    return countries.sort((a, b) => b.visitors - a.visitors);
  }

  /**
   * 生成顶级浏览器数据
   * @returns {Array} 浏览器使用统计
   */
  generateTopBrowsers() {
    const browsers = [
      { name: 'Chrome', usage: 45 + Math.random() * 20 },
      { name: 'Safari', usage: 15 + Math.random() * 15 },
      { name: 'Firefox', usage: 10 + Math.random() * 10 },
      { name: 'Edge', usage: 8 + Math.random() * 8 },
      { name: 'Other', usage: 5 + Math.random() * 5 }
    ];
    
    // 标准化百分比
    const total = browsers.reduce((sum, browser) => sum + browser.usage, 0);
    browsers.forEach(browser => {
      browser.usage = Math.round((browser.usage / total) * 100 * 100) / 100;
    });
    
    return browsers.sort((a, b) => b.usage - a.usage);
  }

  /**
   * 生成警报数据
   * @returns {Array} 警报列表
   */
  generateAlerts() {
    const alerts = [];
    
    // 随机生成一些警报
    if (Math.random() < 0.1) {
      alerts.push({
        id: `alert_${Date.now()}`,
        severity: 'warning',
        message: 'High CPU usage detected',
        timestamp: new Date().toISOString(),
        service: 'Web Server'
      });
    }
    
    if (Math.random() < 0.05) {
      alerts.push({
        id: `alert_${Date.now() + 1}`,
        severity: 'info',
        message: 'Database connection pool expanded',
        timestamp: new Date().toISOString(),
        service: 'Database'
      });
    }
    
    return alerts;
  }

  /**
   * 生成综合仪表板数据
   * @returns {Object} 仪表板数据对象
   */
  generateDashboardData() {
    return {
      timestamp: new Date().toISOString(),
      metrics: this.generateMetrics(),
      analytics: this.generateAnalytics(),
      monitoring: this.generateMonitoring(),
      summary: {
        totalRequests: Math.floor(Math.random() * 10000) + 50000,
        activeUsers: Math.floor(Math.random() * 500) + 100,
        errorRate: Math.round((Math.random() * 0.1) * 100) / 100,
        avgResponseTime: Math.round((50 + Math.random() * 100) * 100) / 100
      }
    };
  }

  /**
   * 获取历史数据
   * @param {string} type - 数据类型 (metrics, analytics, monitoring)
   * @param {number} limit - 返回条数限制
   * @returns {Array} 历史数据数组
   */
  getHistoryData(type, limit = 50) {
    if (!this.dataHistory[type]) {
      return [];
    }
    
    return this.dataHistory[type].slice(-limit);
  }

  /**
   * 清理历史数据
   * @param {number} keepCount - 保留的数据条数
   */
  cleanupHistory(keepCount = 50) {
    Object.keys(this.dataHistory).forEach(type => {
      if (this.dataHistory[type].length > keepCount) {
        this.dataHistory[type] = this.dataHistory[type].slice(-keepCount);
      }
    });
  }

  /**
   * 生成网络流量数据
   * @returns {Object} 网络流量数据
   */
  generateNetworkTraffic() {
    const now = new Date();
    const timeOffset = now.getTime() - this.startTime;
    
    return {
      timestamp: now.toISOString(),
      bandwidth: {
        download: Math.max(0, 500 + 300 * Math.sin(timeOffset / 45000) + Math.random() * 200),
        upload: Math.max(0, 200 + 150 * Math.cos(timeOffset / 35000) + Math.random() * 100)
      },
      packets: {
        received: Math.floor(Math.random() * 1000) + 5000,
        sent: Math.floor(Math.random() * 800) + 3000,
        dropped: Math.floor(Math.random() * 10),
        errors: Math.floor(Math.random() * 5)
      },
      connections: {
        active: Math.floor(Math.random() * 50) + 100,
        established: Math.floor(Math.random() * 30) + 50,
        timeWait: Math.floor(Math.random() * 20) + 10
      }
    };
  }

  /**
   * 生成系统资源数据
   * @returns {Object} 系统资源数据
   */
  generateSystemResources() {
    const now = new Date();
    const timeOffset = now.getTime() - this.startTime;
    
    return {
      timestamp: now.toISOString(),
      cpu: {
        cores: [
          Math.max(0, Math.min(100, 25 + 30 * Math.sin(timeOffset / 60000) + Math.random() * 15)),
          Math.max(0, Math.min(100, 35 + 25 * Math.cos(timeOffset / 55000) + Math.random() * 20)),
          Math.max(0, Math.min(100, 30 + 20 * Math.sin(timeOffset / 50000) + Math.random() * 18)),
          Math.max(0, Math.min(100, 40 + 35 * Math.cos(timeOffset / 65000) + Math.random() * 12))
        ],
        temperature: 45 + Math.random() * 25,
        frequency: 2400 + Math.random() * 800
      },
      memory: {
        used: Math.max(0, Math.min(100, 60 + 20 * Math.sin(timeOffset / 40000) + Math.random() * 15)),
        available: 16384 - Math.floor(Math.random() * 6144),
        cached: Math.floor(Math.random() * 2048) + 1024,
        buffers: Math.floor(Math.random() * 512) + 256
      },
      disk: {
        read: Math.random() * 100,
        write: Math.random() * 80,
        iops: Math.floor(Math.random() * 500) + 200,
        usage: Math.max(0, Math.min(100, 65 + 15 * Math.sin(timeOffset / 120000) + Math.random() * 10))
      }
    };
  }

  /**
   * 生成安全事件数据
   * @returns {Object} 安全事件数据
   */
  generateSecurityEvents() {
    const events = [];
    const now = new Date();
    
    // 随机生成一些安全事件
    if (Math.random() < 0.15) {
      events.push({
        id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'suspicious_login',
        severity: 'medium',
        source: this.generateRandomIP(),
        description: '可疑登录尝试',
        timestamp: now.toISOString()
      });
    }
    
    if (Math.random() < 0.08) {
      events.push({
        id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'port_scan',
        severity: 'low',
        source: this.generateRandomIP(),
        description: '端口扫描检测',
        timestamp: now.toISOString()
      });
    }
    
    if (Math.random() < 0.05) {
      events.push({
        id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        type: 'brute_force',
        severity: 'high',
        source: this.generateRandomIP(),
        description: '暴力破解攻击',
        timestamp: now.toISOString()
      });
    }
    
    return {
      timestamp: now.toISOString(),
      events,
      summary: {
        totalEvents: events.length,
        highSeverity: events.filter(e => e.severity === 'high').length,
        mediumSeverity: events.filter(e => e.severity === 'medium').length,
        lowSeverity: events.filter(e => e.severity === 'low').length
      }
    };
  }

  /**
   * 生成随机IP地址
   * @returns {string} IP地址
   */
  generateRandomIP() {
    return `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`;
  }

  /**
   * 生成数据库性能数据
   * @returns {Object} 数据库性能数据
   */
  generateDatabaseMetrics() {
    const now = new Date();
    
    return {
      timestamp: now.toISOString(),
      queries: {
        total: Math.floor(Math.random() * 1000) + 5000,
        select: Math.floor(Math.random() * 800) + 4000,
        insert: Math.floor(Math.random() * 150) + 500,
        update: Math.floor(Math.random() * 100) + 300,
        delete: Math.floor(Math.random() * 50) + 100
      },
      performance: {
        avgQueryTime: Math.round((5 + Math.random() * 45) * 100) / 100,
        slowQueries: Math.floor(Math.random() * 10),
        connections: Math.floor(Math.random() * 50) + 20,
        lockWaits: Math.floor(Math.random() * 5)
      },
      storage: {
        size: Math.floor(Math.random() * 1000) + 5000,
        growth: Math.round((Math.random() * 2) * 100) / 100,
        indexSize: Math.floor(Math.random() * 500) + 1000
      }
    };
  }

  /**
   * 生成完整的遥测数据包
   * @returns {Object} 完整的遥测数据
   */
  generateTelemetryData() {
    return {
      timestamp: new Date().toISOString(),
      system: this.generateSystemResources(),
      network: this.generateNetworkTraffic(),
      database: this.generateDatabaseMetrics(),
      security: this.generateSecurityEvents(),
      analytics: this.generateAnalytics(),
      monitoring: this.generateMonitoring()
    };
  }
}

module.exports = DecoyDataGenerator;