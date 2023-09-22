const OFFSET = {"TYPE":0,"TYPE_LEN":4,"START":8,"END":12,"COUNT":16,"DATA":20};
export function InitParse(ctx, data) {
	const memory = ctx.exports.memory;
	const bytesPerPage = 65536;
	// Convert the string to UTF-8 bytes
	const utf8Encoder = new TextEncoder();
	const stringBytes = utf8Encoder.encode(data);
	// ONLY grow memory if needed
	const chunks = Math.ceil(memory.buffer.byteLength / bytesPerPage);
	const desireChunks = Math.ceil(stringBytes.byteLength * 10 / bytesPerPage);
	if (desireChunks > chunks) {
		memory.grow(desireChunks - chunks);
	}
	// Copy the string bytes to WebAssembly memory
	const wasmMemory = new Uint8Array(memory.buffer);
	wasmMemory.set(stringBytes, ctx.exports.input.value);
	ctx.exports.inputLength.value = stringBytes.byteLength;
	return ctx.exports._init();
}
export function ProgressCursor(str, bytes, cursorRef) {
	const encoder = new TextEncoder();
	while (cursorRef.bytes <= bytes && cursorRef.ref.index < str.length) {
		const char = str[cursorRef.ref.index];
		const byteSize = encoder.encode(char).byteLength;
		if (cursorRef.bytes + byteSize > bytes) {
			break;
		}
		cursorRef.ref.advance(char === "\n");
		cursorRef.bytes += byteSize;
	}
}
export function MapTreeRefs(tree, str, sharedRef) {
	let stack = [tree];
	let cursor = {
		ref: Reference.blank(),
		bytes: 0
	};
	while (true) {
		const curr = stack.pop();
		if (!curr)
			break;
		if (curr.ref === sharedRef) {
			// Don't calculate forward progression if not needed
			if (cursor.bytes !== curr.start)
				ProgressCursor(str, curr.start, cursor);
			curr.ref = new ReferenceRange(cursor.ref.clone(), cursor.ref // no alloc fill in
			);
			stack.push(curr); // revisit node for ref.end mapping (after children)
			if (typeof (curr.value) !== "string") {
				// Reverse order concat children to stack for FIFO
				for (let i = curr.value.length - 1; i >= 0; i--) {
					stack.push(curr.value[i]);
				}
			}
		}
		else {
			// Don't calculate forward progression if not needed
			if (cursor.bytes !== curr.end)
				ProgressCursor(str, curr.end, cursor);
			curr.ref.end = cursor.ref.clone();
			curr.ref.end.advance(false); // end ref refers to the index after the final char
		}
	}
}
export function Parse(ctx, data, refMapping = true, entry = "program") {
	const heap = InitParse(ctx, data);
	const statusCode = ctx.exports[entry]();
	let reach = Number(ctx.exports.reach);
	if (statusCode == 1) {
		if (refMapping) {
			const cursor = { bytes: 0, ref: Reference.blank() };
			ProgressCursor(data, reach, cursor);
			return new ParseError("Unable to parse", new ReferenceRange(new Reference(0, 0, 0), cursor.ref));
		}
		else {
			return new ParseError("Unable to parse", new ReferenceRange(new Reference(0, 0, 0), new Reference(0, 0, reach)));
		}
	}
	;
	const sharedRef = new ReferenceRange(new Reference(0, 0, 0), new Reference(0, 0, 0));
	const root = Decode(ctx, heap, sharedRef);
	if (refMapping) {
		MapTreeRefs(root, data, sharedRef);
	}
	;
	let reachRef = null;
	if (refMapping) {
		const cursor = { bytes: 0, ref: root.ref.end.clone() };
		ProgressCursor(data, reach, cursor);
		reachRef = cursor.ref;
	}
	return {
		reachBytes: reach,
		isPartial: root.end < ctx.exports.inputLength.value,
		reach: reachRef,
		root,
	};
}
export function Decode(ctx, heap, sharedRef) {
	const memory = ctx.exports.memory;
	const memoryArray = new Int32Array(memory.buffer);
	const byteArray = new Int8Array(memory.buffer);
	const decoder = new TextDecoder();
	const stack = [];
	let root = null;
	let offset = (heap / 4);
	const typeCache = new Map();
	while (root === null || stack.length > 0) {
		const curr = stack[stack.length - 1];
		// Has current stack element been satisfied?
		if (curr && curr.count == curr.value.length) {
			stack.pop();
			continue;
		}
		const type_ptr = memoryArray.at(offset + OFFSET.TYPE / 4) || 0;
		let type = typeCache.get(type_ptr);
		;
		if (!type) {
			const type_len = memoryArray.at(offset + OFFSET.TYPE_LEN / 4) || 0;
			type = decoder.decode(byteArray.slice(type_ptr, type_ptr + type_len));
			typeCache.set(type_ptr, type);
		}
		const next = new SyntaxNode(type, memoryArray.at(offset + OFFSET.START / 4) || 0, memoryArray.at(offset + OFFSET.END / 4) || 0, memoryArray.at(offset + OFFSET.COUNT / 4) || 0, sharedRef);
		offset += OFFSET.DATA / 4;
		// Add child to current top of stack
		//  or make it the root
		if (curr) {
			if (typeof (curr.value) === "string")
				throw new Error("Attempting to add a syntax child to a string");
			curr.value.push(next);
		}
		else {
			root = next;
		}
		// Attempt to satisfy the child
		if (next.type === "literal") {
			const data_ptr = offset * 4; // offset already pushed to data
			const segment = byteArray.slice(data_ptr, data_ptr + next.count);
			next.value = decoder.decode(segment);
			offset += Math.ceil(next.count / 4);
		}
		else {
			stack.push(next);
		}
	}
	if (!root)
		throw new Error("How?");
	return root;
}

export class ParseError {
	constructor(msg, ref) {
		this.stack = [];
		this.msg = msg;
		this.ref = ref;
	}
	add_stack(elm) {
		this.stack.unshift(elm);
	}
	hasStack() {
		return this.stack.length > 0;
	}
	toString() {
		return `Parse Error: ${this.msg} ${this.ref.toString()}` +
			(this.hasStack() ? "\nstack: " + this.stack.join(" -> ") : "");
	}
}
export class SyntaxNode {
	constructor(type, start, end, count, ref) {
		this.type = type;
		this.start = start;
		this.end = end;
		this.count = count;
		this.value = [];
		this.ref = ref;
	}
}
export class Reference {
	constructor(line, col, index) {
		this.line = line;
		this.col = col;
		this.index = index;
	}
	advance(newline = false) {
		if (newline) {
			this.col = 1;
			this.line++;
			this.index++;
		}
		else {
			this.index++;
			this.col++;
		}
	}
	valueOf() {
		return this.index;
	}
	clone() {
		return new Reference(this.line, this.col, this.index);
	}
	toString() {
		return `(${this.line}:${this.col})`;
	}
	static blank() {
		return new Reference(1, 1, 0);
	}
}
export class ReferenceRange {
	constructor(from, to) {
		this.start = from;
		this.end = to;
	}
	span(other) {
		if (other.start.index < this.start.index) {
			this.start = other.start;
		}
		if (other.end.index > this.end.index) {
			this.end = other.end;
		}
	}
	valueOf() {
		return this.end.index;
	}
	clone() {
		return new ReferenceRange(this.start.clone(), this.end.clone());
	}
	toString() {
		return `${this.start.toString()} -> ${this.end.toString()}`;
	}
	static union(a, b) {
		return new ReferenceRange(a.start.index < b.start.index ? a.start.clone() : b.start.clone(), // Smallest
		a.end.index > b.end.index ? a.end.clone() : b.end.clone());
	}
	static intersection(a, b) {
		let start = a.start.index > b.start.index ? a.start.clone() : b.start.clone(); // Largest
		let end = a.end.index < b.end.index ? a.end.clone() : b.end.clone(); // Smallest
		return new ReferenceRange(
		// Make sure start and end haven't switched
		start.index > end.index ? start : end, start.index > end.index ? end : start);
	}
	static blank() {
		return new ReferenceRange(Reference.blank(), Reference.blank());
	}
}
export function AssertUnreachable(x) {
	throw new Error("Unreachable code path reachable");
}
export function DecodeBase64(base64) {
	const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
	let bufferLength = base64.length * 0.75, len = base64.length, i, p = 0, encoded1, encoded2, encoded3, encoded4;
	if (base64[base64.length - 1] === '=') {
		bufferLength--;
		if (base64[base64.length - 2] === '=') {
			bufferLength--;
		}
	}
	let bytes = new Uint8Array(bufferLength);
	for (i = 0; i < len; i += 4) {
		encoded1 = chars.indexOf(base64[i]);
		encoded2 = chars.indexOf(base64[i + 1]);
		encoded3 = chars.indexOf(base64[i + 2]);
		encoded4 = chars.indexOf(base64[i + 3]);
		bytes[p++] = (encoded1 << 2) | (encoded2 >> 4);
		bytes[p++] = ((encoded2 & 15) << 4) | (encoded3 >> 2);
		bytes[p++] = ((encoded3 & 3) << 6) | (encoded4 & 63);
	}
	return bytes;
}
