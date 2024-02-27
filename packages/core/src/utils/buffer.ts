export function makeBufferFromTypedArray(arr: ArrayBufferView | ArrayBuffer): Buffer {
  return ArrayBuffer.isView(arr)
    ? // To avoid a copy, use the typed array's underlying ArrayBuffer to back
      // new Buffer, respecting the "view", i.e. byteOffset and byteLength
      Buffer.from(arr.buffer, arr.byteOffset, arr.byteLength)
    : // Pass through all other types to `Buffer.from`
      Buffer.from(arr);
}
