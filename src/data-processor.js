// const crypto = require('crypto'); // No longer needed for parsing
const config = require('./config');

/**
 * Data Processor
 * Responsible for parsing client data packets to extract target host and port.
 * This implementation is specifically designed to handle modern proxy protocols
 * like VLESS, which are commonly used by clients such as V2Ray/Xray.
 */
class DataProcessor {
  constructor() {
    this.config = config;
  }

  /**
   * Parses the first data packet from a client to extract the target address and port.
   * The logic follows the VLESS protocol structure.
   *
   * VLESS Request Structure (relevant parts for parsing):
   * - 1 byte: Version
   * - 16 bytes: UUID
   * - 1 byte: Addon Length (N)
   * - N bytes: Addons
   * - 1 byte: Command
   * - 2 bytes: Port (Big Endian)
   * - 1 byte: Address Type (ATYP)
   *   - 1: IPv4 (4 bytes)
   *   - 3: Domain Name (1 byte length + N bytes name)
   *   - 4: IPv6 (16 bytes)
   * - M bytes: Address
   *
   * @param {Buffer} data - The raw data packet from the client.
   * @returns {{success: boolean, host?: string, port?: number, error?: string}} An object indicating parsing result.
   */
  parseDataPacket(data) {
    if (!Buffer.isBuffer(data)) {
      return { success: false, error: 'Invalid data type, expected Buffer.' };
    }

    try {
      let offset = 0;

      // 1. Skip Version (1 byte) and UUID (16 bytes)
      if (data.length < 17) {
        return { success: false, error: 'Packet too short for Version and UUID.' };
      }
      offset += 17;

      // 2. Read and skip Addons
      if (data.length < offset + 1) {
        return { success: false, error: 'Packet too short for Addon Length.' };
      }
      const addonLength = data.readUInt8(offset);
      offset += 1;
      if (data.length < offset + addonLength) {
        return { success: false, error: 'Packet too short for Addons data.' };
      }
      offset += addonLength;

      // 3. Read Command (1 byte) - and skip it
      if (data.length < offset + 1) {
        return { success: false, error: 'Packet too short for Command.' };
      }
      // const command = data.readUInt8(offset); // We don't use it, just skip
      offset += 1;

      // 4. Read Port (2 bytes, Big Endian)
      if (data.length < offset + 2) {
        return { success: false, error: 'Packet too short for Port.' };
      }
      const port = data.readUInt16BE(offset);
      offset += 2;

      // 5. Read Address Type (ATYP)
      if (data.length < offset + 1) {
        return { success: false, error: 'Packet too short for Address Type (ATYP).' };
      }
      const addressType = data.readUInt8(offset);
      offset += 1;

      let host;

      switch (addressType) {
        case 1: // ATYP = 1: IPv4 Address (4 bytes)
          if (data.length < offset + 4) {
            return { success: false, error: 'Incomplete IPv4 address data.' };
          }
          host = data.slice(offset, offset + 4).join('.');
          offset += 4;
          break;

        case 3: // ATYP = 3: Domain Name (1 byte length + N bytes)
          if (data.length < offset + 1) {
            return { success: false, error: 'Missing domain name length.' };
          }
          const domainLength = data.readUInt8(offset);
          offset += 1;

          if (data.length < offset + domainLength) {
            return { success: false, error: 'Incomplete domain name data.' };
          }
          host = data.slice(offset, offset + domainLength).toString('utf8');
          offset += domainLength;
          break;

        case 4: // ATYP = 4: IPv6 Address (16 bytes)
          if (data.length < offset + 16) {
            return { success: false, error: 'Incomplete IPv6 address data.' };
          }
          const ipv6Buffer = data.slice(offset, offset + 16);
          const ipv6Parts = [];
          for (let i = 0; i < 8; i++) {
            ipv6Parts.push(ipv6Buffer.readUInt16BE(i * 2).toString(16));
          }
          host = ipv6Parts.join(':');
          offset += 16;
          break;

        default:
          return { success: false, error: `Unsupported address type: ${addressType}` };
      }

      const remainingBuffer = data.slice(offset);
      console.log(`[Parser] Successfully parsed target: ${host}:${port}`);
      return { success: true, host, port, remainingBuffer };

    } catch (err) {
      // This will catch Buffer read errors (e.g., out of bounds)
      const error = `[Parser] Critical parsing error: ${err.message}`;
      console.error(error);
      return { success: false, error };
    }
  }
}

module.exports = DataProcessor;