'use strict';

function toBinaryUUID(id) {
  const buf = Buffer.from(id.replace(/-/g, ''), 'hex');
  return Buffer.concat([buf.slice(6, 8), buf.slice(4, 6), buf.slice(0, 4), buf.slice(8, 16)]);
}

exports.toBinaryUUID = toBinaryUUID;

function fromBinaryUUID(buf) {
  return [
    buf.toString('hex', 4, 8),
    buf.toString('hex', 2, 4),
    buf.toString('hex', 0, 2),
    buf.toString('hex', 8, 10),
    buf.toString('hex', 10, 16)
  ].join('-');
}

exports.fromBinaryUUID = fromBinaryUUID;
