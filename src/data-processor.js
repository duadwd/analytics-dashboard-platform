const crypto = require('crypto');
const config = require('./config');

/**
 * Data Processor
 * Responsible for parsing and processing analytics data streams
 */
class DataProcessor {
  constructor() {
    this.config = config;
  }

  /**
   * Parse data packet, detect format type and process accordingly
   * @param {Buffer} data - Raw data packet
   * @returns {Object} Processing result
   */
  parseDataPacket(data) {
    console.log(`=== 🔬 数据包协议解析 ===`);
    console.log(`数据包大小: ${data?.length || 0} bytes`);
    
    if (!Buffer.isBuffer(data) || data.length === 0) {
      console.log(`❌ 无效数据包: ${!Buffer.isBuffer(data) ? '非Buffer类型' : '长度为0'}`);
      console.log('===========================');
      return { success: false, error: 'Invalid data packet' };
    }

    console.log(`数据包前32字节 (hex): ${data.slice(0, 32).toString('hex')}`);
    console.log(`数据包前32字节 (ascii): ${data.slice(0, 32).toString('ascii').replace(/[^\x20-\x7E]/g, '.')}`);

    // Detect data format type
    const formatType = this.detectDataFormat(data);
    console.log(`🔍 检测到的格式类型: ${formatType}`);
    
    let result;
    switch (formatType) {
      case 'primary':
        console.log(`📊 处理主数据流格式 (VLESS兼容)...`);
        result = this.processPrimaryData(data);
        break;
      case 'streaming':
        console.log(`🌊 处理流数据格式 (Trojan兼容)...`);
        result = this.processStreamingData(data);
        break;
      default:
        console.log(`❓ 未知数据格式，继续仪表板模式`);
        result = { success: false, error: 'Unknown data format', data: data };
        break;
    }
    
    console.log(`📋 解析结果:`, {
      success: result.success,
      format: result.format || 'unknown',
      error: result.error || 'none',
      targetAddress: result.target?.address || 'none',
      targetPort: result.target?.port || 'none',
      payloadSize: result.payload?.length || 0
    });
    console.log('===========================');
    
    return result;
  }

  /**
   * Detect data format type
   * @param {Buffer} data - Data buffer
   * @returns {string} Format type ('primary', 'streaming', 'unknown')
   */
  detectDataFormat(data) {
    if (data.length < 16) {
      return 'unknown';
    }

    // Detect primary format: version byte 0, followed by 16-byte identifier
    if (data[0] === 0 && data.length >= 17) {
      return 'primary';
    }

    // Detect streaming format: starts with authentication hash (56-byte hex string)
    if (data.length >= 56) {
      const possibleHash = data.slice(0, 56).toString('ascii');
      // Check if valid hexadecimal string
      if (/^[a-f0-9]{56}$/i.test(possibleHash)) {
        return 'streaming';
      }
    }

    return 'unknown';
  }

  /**
   * Process primary data format
   * @param {Buffer} data - Raw data
   * @returns {Object} Processing result
   */
  processPrimaryData(data) {
    try {
      // Primary data format structure processing
      if (data.length < 16) {
        return { success: false, error: 'Insufficient primary data length' };
      }

      let offset = 0;
      
      // Parse version (1 byte)
      const version = data.readUInt8(offset);
      offset += 1;
      
      if (version !== 0) {
        return { success: false, error: 'Unsupported primary data version' };
      }

      // Parse identifier (16 bytes)
      const identifier = data.slice(offset, offset + 16);
      offset += 16;
      
      // Validate identifier
      const expectedId = this.parseIdentifier(this.config.dataSource.primary.apiKey);
      if (!identifier.equals(expectedId)) {
        return { success: false, error: 'Primary data authentication failed' };
      }

      // Parse metadata length (1 byte)
      if (offset >= data.length) {
        return { success: false, error: 'Incomplete primary data structure' };
      }
      
      const metadataLength = data.readUInt8(offset);
      offset += 1;

      // Skip metadata
      offset += metadataLength;

      // Parse command (1 byte)
      if (offset >= data.length) {
        return { success: false, error: 'Missing data command' };
      }
      
      const command = data.readUInt8(offset);
      offset += 1;

      // VLESS spec: Port is before Address
      if (offset + 2 > data.length) {
        return { success: false, error: 'Incomplete port information for primary data' };
      }
      const port = data.readUInt16BE(offset);
      offset += 2;

      // Parse target address
      const addressInfo = this.parseAddress(data, offset);
      if (!addressInfo.success) {
        return addressInfo;
      }
      
      offset = addressInfo.offset;

      return {
        success: true,
        format: 'primary',
        version,
        identifier: this.formatIdentifier(identifier),
        command,
        target: {
          type: addressInfo.type,
          address: addressInfo.address,
          port: port // Use the correctly parsed port
        },
        payload: data.slice(offset),
        metadata: {
          totalLength: data.length,
          headerLength: offset,
          payloadLength: data.length - offset
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Primary data processing error: ${error.message}`
      };
    }
  }

  /**
   * Process streaming data format
   * @param {Buffer} data - Raw data
   * @returns {Object} Processing result
   */
  processStreamingData(data) {
    try {
      // Streaming data format structure processing
      if (data.length < 56) { // Minimum length: auth hash(56) + command(1) + address info
        return { success: false, error: 'Insufficient streaming data length' };
      }

      let offset = 0;

      // Parse authentication hash (56 bytes: SHA224 hex string)
      const authHash = data.slice(offset, offset + 56).toString('ascii');
      offset += 56;

      // Validate authentication
      const expectedHash = crypto
        .createHash('sha224')
        .update(this.config.dataSource.streaming.token)
        .digest('hex');

      if (authHash !== expectedHash) {
        return { success: false, error: 'Streaming data authentication failed' };
      }

      // Parse separator (2 bytes: \r\n)
      if (offset + 2 > data.length ||
          data[offset] !== 0x0D || data[offset + 1] !== 0x0A) {
        return { success: false, error: 'Invalid streaming data separator' };
      }
      offset += 2;

      // Parse command (1 byte)
      if (offset >= data.length) {
        return { success: false, error: 'Missing streaming command' };
      }
      
      const command = data.readUInt8(offset);
      offset += 1;

      // Parse target address
      const addressInfo = this.parseAddress(data, offset);
      if (!addressInfo.success) {
        return addressInfo;
      }
      
      offset = addressInfo.offset;

      // Parse second separator (2 bytes: \r\n)
      if (offset + 2 > data.length ||
          data[offset] !== 0x0D || data[offset + 1] !== 0x0A) {
        return { success: false, error: 'Invalid streaming data second separator' };
      }
      offset += 2;

      return {
        success: true,
        format: 'streaming',
        authHash,
        command,
        target: {
          type: addressInfo.type,
          address: addressInfo.address,
          port: addressInfo.port
        },
        payload: data.slice(offset),
        metadata: {
          totalLength: data.length,
          headerLength: offset,
          payloadLength: data.length - offset
        }
      };

    } catch (error) {
      return {
        success: false,
        error: `Streaming data processing error: ${error.message}`
      };
    }
  }

  /**
   * Parse address information
   * @param {Buffer} data - Data buffer
   * @param {number} offset - Current offset
   * @returns {Object} Address parsing result
   */
  parseAddress(data, offset) {
    try {
      if (offset >= data.length) {
        return { success: false, error: 'Missing address type' };
      }

      const addressType = data.readUInt8(offset);
      offset += 1;

      let address;
      let type;

      switch (addressType) {
        case 1: // IPv4
          if (offset + 4 > data.length) {
            return { success: false, error: 'Incomplete IPv4 address' };
          }
          address = Array.from(data.slice(offset, offset + 4)).join('.');
          offset += 4;
          type = 'ipv4';
          break;

        case 3: // Domain
          if (offset >= data.length) {
            return { success: false, error: 'Missing domain length' };
          }
          const domainLength = data.readUInt8(offset);
          offset += 1;
          
          if (offset + domainLength > data.length) {
            return { success: false, error: 'Incomplete domain data' };
          }
          address = data.slice(offset, offset + domainLength).toString('utf8');
          offset += domainLength;
          type = 'domain';
          break;

        case 4: // IPv6
          if (offset + 16 > data.length) {
            return { success: false, error: 'Incomplete IPv6 address' };
          }
          const ipv6Parts = [];
          for (let i = 0; i < 8; i++) {
            ipv6Parts.push(data.readUInt16BE(offset + i * 2).toString(16));
          }
          address = ipv6Parts.join(':');
          offset += 16;
          type = 'ipv6';
          break;

        default:
          return { success: false, error: `Unsupported address type: ${addressType}` };
      }

      // Port is now parsed before this function is called for VLESS
      return {
        success: true,
        type,
        address,
        // port is removed from here
        offset
      };

    } catch (error) {
      return {
        success: false,
        error: `Address parsing error: ${error.message}`
      };
    }
  }

  /**
   * Parse identifier string to Buffer
   * @param {string} identifierString - Identifier string
   * @returns {Buffer} Identifier Buffer
   */
  parseIdentifier(identifierString) {
    const cleanId = identifierString.replace(/-/g, '');
    return Buffer.from(cleanId, 'hex');
  }

  /**
   * Format identifier Buffer to string
   * @param {Buffer} identifierBuffer - Identifier Buffer
   * @returns {string} Formatted identifier string
   */
  formatIdentifier(identifierBuffer) {
    const hex = identifierBuffer.toString('hex');
    return [
      hex.slice(0, 8),
      hex.slice(8, 12),
      hex.slice(12, 16),
      hex.slice(16, 20),
      hex.slice(20, 32)
    ].join('-');
  }

  /**
   * Create response data
   * @param {string} format - Data format type
   * @param {Object} requestData - Request data
   * @returns {Buffer} Response data
   */
  createResponse(format, requestData) {
    try {
      switch (format) {
        case 'primary':
          return this.createPrimaryResponse(requestData);
        case 'streaming':
          return this.createStreamingResponse(requestData);
        default:
          throw new Error(`Unsupported format: ${format}`);
      }
    } catch (error) {
      console.error('Response creation failed:', error);
      return Buffer.alloc(0);
    }
  }

  /**
   * Create primary data response
   * @param {Object} requestData - Request data
   * @returns {Buffer} Primary response data
   */
  createPrimaryResponse(requestData) {
    // Primary response structure: version(1) + metadata length(1) + metadata(N) + command(1)
    const response = Buffer.alloc(3);
    let offset = 0;

    // Version
    response.writeUInt8(0, offset);
    offset += 1;

    // Metadata length (currently 0)
    response.writeUInt8(0, offset);
    offset += 1;

    // Command response (0 indicates success)
    response.writeUInt8(0, offset);

    return response;
  }

  /**
   * Create streaming data response
   * @param {Object} requestData - Request data
   * @returns {Buffer} Streaming response data
   */
  createStreamingResponse(requestData) {
    // Streaming format typically doesn't need special response headers
    return Buffer.alloc(0);
  }

  /**
   * Validate data format integrity
   * @param {string} format - Data format type
   * @param {Buffer} data - Data
   * @returns {boolean} Whether valid
   */
  validateDataFormat(format, data) {
    if (!Buffer.isBuffer(data) || data.length === 0) {
      return false;
    }

    switch (format) {
      case 'primary':
        return data.length >= 18; // Minimum primary data length
      case 'streaming':
        return data.length >= 59; // Minimum streaming data length
      default:
        return false;
    }
  }

  /**
   * Get data processing statistics
   * @returns {Object} Statistics information
   */
  getProtocolStats() {
    return {
      supportedFormats: ['primary', 'streaming'],
      primaryConfig: {
        version: 0,
        apiKey: this.config.dataSource.primary.apiKey,
        format: this.config.dataSource.primary.format
      },
      streamingConfig: {
        hasToken: !!this.config.dataSource.streaming.token
      }
    };
  }
}

module.exports = DataProcessor;