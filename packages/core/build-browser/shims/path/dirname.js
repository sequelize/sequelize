export default function dirname(path) {
  return posix(path);
}

// Copied from:
// https://github.com/gulpjs/path-dirname/blob/master/index.js
function posix(path) {
  // assertPath(path);
  if (path.length === 0) {
    return '.';
  }

  let code = path.codePointAt(0);
  const hasRoot = (code === 47);
  let end = -1;
  let matchedSlash = true;
  for (let i = path.length - 1; i >= 1; --i) {
    code = path.codePointAt(i);
    if (code === 47) {
      if (!matchedSlash) {
        end = i;
        break;
      }
    } else {
      // We saw the first non-path separator
      matchedSlash = false;
    }
  }

  if (end === -1) {
    return hasRoot ? '/' : '.';
  }

  if (hasRoot && end === 1) {
    return '//';
  }

  return path.slice(0, end);
}
