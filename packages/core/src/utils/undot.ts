/**
 * Tiny precompiler + setter to replace Dottie.transform for flat "a.b[0].c" keys.
 * Advantages:
 * - No deps
 * - Handles dot paths and [number] array indices
 * - Fast: pre-tokenizes keys once, then does straight-line writes
 *
 * some linting rules are skipped for performance optimizations.
 */

type PathSeg = string | number;

export interface CompiledPath {
  sourceKey: string;
  path: PathSeg[];
}

export interface PrecompiledTransform {
  // Dense array for tight loops
  compiled: CompiledPath[];
  // Quick lookups
  index: Map<string, PathSeg[]>;
}

/**
 * Tokenize a single flat path like: "a.b[0].c"
 * - Dots split object keys
 * - Brackets with digits create numeric array indices
 * - Does NOT implement escaping / quoted keys; keep keys simple for max perf
 *
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
    // disable linting rule for performance.
    /* eslint-disable-next-line unicorn/prefer-code-point */
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
      let hasClosingBracket = false;

      // read digits until ']'
      while (i < n) {
        // eslint-disable-next-line unicorn/prefer-code-point
        const c = key.charCodeAt(i);
        if (c >= 48 && c <= 57) {
          hasDigit = true;
          num = num * 10 + (c - 48);
          i++;
          continue;
        }

        if (c === 93 /* ']' */) {
          hasClosingBracket = true;
          i++;
          break;
        }

        // Non-digit inside brackets: fallback to simple behavior (treat as text)
        // For perf, this doesn't support ["complex.key"] patterns.
        throw new Error(`Unsupported bracket syntax in key: ${key}`);
      }

      if (!hasClosingBracket) {
        throw new Error(`Unterminated bracket in key: ${key}`);
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
  /* eslint-disable-next-line unicorn/no-new-array */
  const compiled: CompiledPath[] = new Array(keys.length);
  const index = new Map<string, PathSeg[]>();

  // disable linting rule for performance.
  /* eslint-disable-next-line unicorn/no-for-loop */
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    // Fast path: if no '.' and no '[' then it’s a direct write, store a single string seg

    // eslint-disable-next-line @typescript-eslint/prefer-includes, unicorn/prefer-includes  -- disabled for performance
    const hasDot = k.indexOf('.') >= 0;
    /* eslint-disable-next-line @typescript-eslint/prefer-includes, unicorn/prefer-includes  */
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
  obj[leaf] = value;
}

/**
 * Transform a flat row with precompiled paths into a nested object.
 * Optionally reuse an output object (e.g., from a pool) for fewer allocations.
 *
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
  // eslint-disable-next-line unicorn/no-for-loop -- disabled for performance
  for (let i = 0; i < compiled.length; i++) {
    const { sourceKey, path } = compiled[i];
    const v = (row as any)[sourceKey];
    // Skip undefineds to mimic common transform behavior (optional)
    if (v !== undefined) {
      setByPathArray(target, path, v);
    }
  }

  return target;
}

/**
 * Acquire an object from a simple pool and clear its own keys.
 *
 * @param pool Pool of reusable plain objects
 * @returns A cleared object ready for reuse
 */
export function acquirePooledObject(pool: Array<Record<string, unknown>>): Record<string, unknown> {
  const obj = pool.pop();
  if (!obj) {
    return {};
  }
  // Clear previous contents

  const keys = Object.keys(obj);
  // disable linting rule for performance.
  /* eslint-disable-next-line unicorn/no-for-loop */
  for (let i = 0; i < keys.length; i++) {
    delete (obj as any)[keys[i]];
  }

  return obj;
}

export function releasePooledObject(
  pool: Array<Record<string, unknown>>,
  obj: Record<string, unknown>,
): void {
  pool.push(obj);
}
