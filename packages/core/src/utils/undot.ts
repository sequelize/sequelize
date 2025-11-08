/* eslint-disable unicorn/no-new-array */
/* eslint-disable unicorn/prefer-includes */
/* eslint-disable @typescript-eslint/prefer-includes */
/* eslint-disable unicorn/no-for-loop */
/* eslint-disable unicorn/prefer-code-point */
/**
 * Tiny precompiler + setter to replace Dottie.transform for flat "a.b[0].c" keys.
 * Advantages:
 * - No deps
 * - TS typed
 * - Handles dot paths and [number] array indices
 * - Fast: pre-tokenizes keys once, then does straight-line writes
 *
 * disable some linting rules for performance.
 */

type PathSeg = string | number;

export interface CompiledPath {
  sourceKey: string;
  path: PathSeg[];
}

export interface PrecompiledTransform {
  // Dense array for tight loops
  compiled: CompiledPath[];
  // Quick lookup if needed (optional)
  index: Map<string, PathSeg[]>;
}

/**
 * Tokenize a single flat path like: "a.b[0].c"
 * - Dots split object keys
 * - Brackets with digits create numeric array indices
 * - Does NOT implement escaping / quoted keys; keep keys simple for max perf
 * @param key The flat key to tokenize
 */
export function tokenizePath(key: string): PathSeg[] {
  const out: PathSeg[] = [];
  let i = 0;
  const n = key.length;
  let buf = '';

  const flushBuf = () => {
    if (buf.length) {
      out.push(buf);
      buf = '';
    }
  };

  while (i < n) {
    const ch = key.charCodeAt(i);
    if (ch === 46 /* '.' */) {
      flushBuf();
      i++;
      continue;
    }

    if (ch === 91 /* '[' */) {
      // entering bracket
      flushBuf();
      i++;
      let num = 0;
      let hasDigit = false;

      // read digits until ']'
      while (i < n) {
        const c = key.charCodeAt(i);
        if (c >= 48 && c <= 57) {
          hasDigit = true;
          num = num * 10 + (c - 48);
          i++;
          continue;
        }

        if (c === 93 /* ']' */) {
          i++;
          break;
        }

        // Non-digit inside brackets: fallback to simple behavior (treat as text)
        // For perf, this doesn't support ["complex.key"] patterns.
        throw new Error(`Unsupported bracket syntax in key: ${key}`);
      }

      if (!hasDigit) {
        throw new Error(`Empty or non-numeric bracket in key: ${key}`);
      }

      out.push(num);
      continue;
    }

    // normal char
    buf += key[i++];
  }

  flushBuf();

  return out;
}

/**
 * Precompile all keys once per result-set shape.
 * Pass in the enumerable keys you will transform (e.g., Object.keys(row)).
 *
 * @param keys The flat keys to precompile
 */
export function precompileKeys(keys: readonly string[]): PrecompiledTransform {
  const compiled: CompiledPath[] = new Array(keys.length);
  const index = new Map<string, PathSeg[]>();

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    // Fast path: if no '.' and no '[' then it’s a direct write, store a single string seg
    const hasDot = k.indexOf('.') >= 0;
    const hasBracket = k.indexOf('[') >= 0;

    const path = hasDot || hasBracket ? tokenizePath(k) : [k];

    compiled[i] = { sourceKey: k, path };
    index.set(k, path);
  }

  return { compiled, index };
}

/**
 * Set a value by a tokenized path on the target, creating intermediate objects/arrays.
 * Creates arrays when the next segment is a number, objects otherwise.
 *
 * @param target The target object to set the value on
 * @param path The tokenized path array
 * @param value The value to set
 */
export function setByPathArray(
  target: Record<string, unknown>,
  path: readonly PathSeg[],
  value: unknown,
): void {
  let obj: any = target;
  const last = path.length - 1;

  for (let i = 0; i < last; i++) {
    const seg = path[i];
    const nextIsIndex = typeof path[i + 1] === 'number';

    if (typeof seg === 'number') {
      // current should be array
      if (!Array.isArray(obj)) {
        // If we somehow landed on non-array (mis-shaped), replace it
        obj = [];
      }
      // Ensure parent points to this array (caller must have assigned obj)
      // But because we always assign at parent step, we only need to ensure slot exists

      if (obj[seg] == null) {
        obj[seg] = nextIsIndex ? [] : {};
      }

      obj = obj[seg];
    } else {
      // object seg
      let next = obj[seg];
      if (next == null || (typeof next !== 'object' && !Array.isArray(next))) {
        obj[seg] = nextIsIndex ? [] : {};
        next = obj[seg];
      }

      obj = next;
    }
  }

  const leaf = path[last];
  if (typeof leaf === 'number') {
    if (!Array.isArray(obj)) {
      // Convert to array for correctness; small overhead but rare in well-formed paths
      // (If you want to be stricter, throw instead.)
      const arr: any[] = [];
      (obj as any[]).length = 0; // drop refs (no-op if not array)
      obj = arr;
    }

    obj[leaf] = value;
  } else {
    obj[leaf] = value;
  }
}

/**
 * Transform a flat row with precompiled paths into a nested object.
 * Optionally reuse an output object (e.g., from a pool) for fewer allocations.
 * @param row The flat row object to transform
 * @param pre The precompiled transform data
 * @param out Optional output object to reuse
 */
export function transformRowWithPrecompiled(
  row: Record<string, unknown>,
  pre: PrecompiledTransform,
  out?: Record<string, unknown>,
): Record<string, unknown> {
  const target = out ?? {};
  const { compiled } = pre;

  for (let i = 0; i < compiled.length; i++) {
    const { sourceKey, path } = compiled[i];
    if (Object.prototype.hasOwnProperty.call(row, sourceKey)) {
      const v = (row as any)[sourceKey];
      // Skip undefineds to mimic common transform behavior (optional)
      if (v !== undefined) {
        setByPathArray(target, path, v);
      }
    }
  }

  return target;
}

/**
 * Optional: tiny object pool to reuse result objects in tight loops.
 * Clear with a super-fast key iteration (no Object.keys allocation).
 */
export function acquirePooledObject(pool: Record<string, unknown>[]): Record<string, unknown> {
  const obj = pool.pop();
  if (!obj) return {};
  // Clear previous contents
  for (const k of Object.keys(obj)) {
    delete (obj as any)[k];
  }
  return obj;
}

export function releasePooledObject(
  pool: Record<string, unknown>[],
  obj: Record<string, unknown>,
): void {
  pool.push(obj);
}

/* ===========================
   Example usage in your loop
   =========================== */

// Suppose processedResults: Array<Record<string, unknown>>
export function transformAll(
  processedResults: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  if (processedResults.length === 0) return [];

  // Precompile ONCE for the shape (columns) in your result set:
  const first = processedResults[0];
  const keys = Object.keys(first);
  const pre = precompileKeys(keys);

  // Optional: a small pool if you need to reuse outputs (avoid GC churn).
  // For most cases, just do `const out = {};` each iteration for simplicity.
  const pool: Record<string, unknown>[] = [];

  const out: Record<string, unknown>[] = new Array(processedResults.length);
  for (let i = 0; i < processedResults.length; i++) {
    // If rows can have missing columns, we still reuse precompiled keys—missing keys are skipped.
    const target = acquirePooledObject(pool);
    out[i] = transformRowWithPrecompiled(processedResults[i], pre, target);
    // If you want to keep the outputs, don’t release to pool.
    // If you reuse elsewhere, you can release here after consuming them:
    // releasePooledObject(pool, out[i]);
  }
  return out;
}
