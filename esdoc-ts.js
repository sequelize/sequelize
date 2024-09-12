const path = require('path');
const { transformSync } = require('esbuild');

module.exports = {
  onHandleCode({ data }) {
    if (path.extname(data.filePath) === '.ts') {
      // @preserve tells esbuild not to omit the comment.  This is intended for legal comments,
      // but works here too as a hack.
      data.code = transformSync(data.code.replace(/\/\*\*/g, '/**@preserve'), {
        target: 'node10',
        format: 'cjs',
        loader: 'ts'
      }).code.replace(/\/\*\*@preserve/g, '/**');
    }
  }
};
