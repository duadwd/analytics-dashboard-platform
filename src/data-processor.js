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
    // Minimum length check: 1(Ver) + 16(UUID) + 1(AddonLen) + 1(Cmd) + 2(Port) + 1(ATYP) + 1(AddrLen) + 1(Addr) = 24
    if (!Buffer.isBuffer(data) || data.length < 24) {
      const error = '[Parser] Invalid data packet: not a buffer or too short for a valid header.';
      console.error(error);
      return { success: false, error };
    }

    try {
      let offset = 0;

      // --- Skip VLESS Header ---
      // 1. Version (1 byte) + UUID (16 bytes)
      offset += 17;

      // 2. Addons (variable length)
      const addonLength = data.readUInt8(offset);
      offset += 1 + addonLength;

      // 3. Command (1 byte)
      offset += 1;

      // --- Parse Target Address ---
      // Check if there's enough data for Port and ATYP
      if (data.length < offset + 3) {
        const error = '[Parser] Packet too short to contain port and address type.';
        console.error(error);
        return { success: false, error };
      }

      // 4. Port (2 bytes, Big Endian)
      const port = data.readUInt16BE(offset);
      offset += 2;

      // 5. Address Type (ATYP)
      const addressType = data.readUInt8(offset);
      offset += 1;

      let host;

      switch (addressType) {
        case 1: // ATYP = 1: IPv4 Address (4 bytes)
          if (data.length < offset + 4) {
            const error = '[Parser] Incomplete IPv4 address data in packet.';
            console.error(error);
            return { success: false, error };
          }
          host = Array.from(data.slice(offset, offset + 4)).join('.');
          break;

        case 2: // ATYP = 2: Domain Name (similar to ATYP 3)
        case 3: // ATYP = 3: Domain Name (1 byte length + N bytes)
          if (data.length < offset + 1) {
            const error = '[Parser] Missing domain name length in packet.';
            console.error(error);
            return { success: false, error };
          }
          const domainLength = data.readUInt8(offset);
          offset += 1;

          if (data.length < offset + domainLength) {
            const error = '[Parser] Incomplete domain name data in packet.';
            console.error(error);
            return { success: false, error };
          }
          host = data.slice(offset, offset + domainLength).toString('utf8');
          break;

        case 4: // ATYP = 4: IPv6 Address (16 bytes)
          if (data.length < offset + 16) {
            const error = '[Parser] Incomplete IPv6 address data in packet.';
            console.error(error);
            return { success: false, error };
          }
          const ipv6Parts = [];
          for (let i = 0; i < 8; i++) {
            ipv6Parts.push(data.readUInt16BE(offset + i * 2).toString(16));
          }
          host = ipv6Parts.join(':');
          break;

        default:
          const error = `[Parser] Unsupported address type encountered: ${addressType}`;
          console.error(error);
          return { success: false, error };
      }

      console.log(`[Parser] Successfully parsed target address: ${host}:${port}`);
      return { success: true, host, port };

    } catch (err) {
      const error = `[Parser] An error occurred during packet parsing: ${err.message}`;
      console.error(error);
      return { success: false, error };
    }
  }
}

module.exports = DataProcessor;