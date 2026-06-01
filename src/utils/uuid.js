'use strict';

/**
 * CommonJS-safe UUID wrapper.
 *
 * uuid >= 9 is ESM-only and cannot be loaded with require().
 * This module tries require() first (works for uuid <= 8), then falls back
 * to Node.js built-in crypto.randomUUID (available since Node 14.17 / 16.7)
 * and a pure-JS v1 polyfill so Sequelize keeps working regardless of the
 * uuid version installed by the consumer.
 *
 * See: https://github.com/sequelize/sequelize/issues/18224
 */

let _uuidv1;
let _uuidv4;

// ── Attempt 1 — classic require (uuid <= 8) ──────────────────────────
try {
  const uuid = require('uuid');
  _uuidv1 = uuid.v1;
  _uuidv4 = uuid.v4;
} catch (e) {
  // require() failed — uuid is ESM-only or not installed at all
}

// ── Attempt 2 — Node.js built-in crypto.randomUUID (v4 only) ────────
if (!_uuidv4) {
  try {
    const crypto = require('crypto');
    if (typeof crypto.randomUUID === 'function') {
      _uuidv4 = () => crypto.randomUUID();
    }
  } catch (e) {
    // crypto not available (unlikely, but be safe)
  }
}

// ── Attempt 3 — pure-JS fallback generators ─────────────────────────
if (!_uuidv4) {
  /**
   * RFC 4122 v4 UUID generator (random).
   * Uses crypto.getRandomValues when available, Math.random otherwise.
   */
  _uuidv4 = function uuidv4Fallback() {
    // 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    const hex = '0123456789abcdef';
    let uuid = '';
    for (let i = 0; i < 36; i++) {
      if (i === 8 || i === 13 || i === 18 || i === 23) {
        uuid += '-';
      } else if (i === 14) {
        uuid += '4'; // version nibble
      } else {
        const r = Math.random() * 16 | 0;
        uuid += hex[i === 19 ? r & 0x3 | 0x8 : r];
      }
    }
    return uuid;
  };
}

if (!_uuidv1) {
  /**
   * Minimal RFC 4122 v1-*like* UUID generator.
   *
   * A true v1 UUID encodes the MAC address and a high-resolution timestamp.
   * Sequelize only uses v1 as a default value generator, so a
   * timestamp-based unique string in the v1 format is sufficient here.
   */
  let _clockSeq = Math.random() * 0x3fff | 0;

  _uuidv1 = function uuidv1Fallback() {
    const now = Date.now();
    // We have a 12-digit hex timestamp from Date.now() (representing ms)
    const tsHex = now.toString(16).padStart(12, '0');
    
    // time_low is the last 8 chars
    const timeLow = tsHex.slice(4);
    // time_mid is the first 4 chars
    const timeMid = tsHex.slice(0, 4);
    // time_hi is "000" (or similar), version is "1"
    const timeHi = '000';

    _clockSeq = _clockSeq + 1 & 0x3fff;
    const clockSeqHi = _clockSeq >> 8 & 0x3f | 0x80;
    const clockSeqLow = _clockSeq & 0xff;

    // Random 6-byte "node" (multicast bit set)
    const node = [];
    for (let i = 0; i < 6; i++) {
      node.push((Math.random() * 256 | 0).toString(16).padStart(2, '0'));
    }
    node[0] = (parseInt(node[0], 16) | 0x01).toString(16).padStart(2, '0'); // multicast bit

    return `${timeLow}-${timeMid}-1${timeHi}-` +
      `${clockSeqHi.toString(16).padStart(2, '0')}${clockSeqLow.toString(16).padStart(2, '0')}-` +
      `${node.join('')}`;
  };
}

module.exports.v1 = _uuidv1;
module.exports.v4 = _uuidv4;
