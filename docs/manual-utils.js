'use strict';

const _ = require('lodash');
const jetpack = require('fs-jetpack');
const { normalize } = require('path');
const assert = require('assert');

function getDeclaredManuals() {
  const declaredManualGroups = require('./manual-groups.json');
  return _.flatten(Object.values(declaredManualGroups)).map(file => {
    return normalize(`./docs/manual/${file}`);
  });
}

function getAllManuals() {
  return jetpack.find('./docs/manual/', { matching: '*.md' }).map(m => {
    return normalize(`./${m}`);
  });
}

function checkManuals() {
  // First we check that declared manuals and all manuals are the same
  const declared = getDeclaredManuals().sort();
  const all = getAllManuals().sort();
  assert.deepStrictEqual(declared, all);

  // Then we check that every manual begins with a single `#`. This is
  // important for ESDoc to render the left menu correctly.
  for (const manualRelativePath of all) {
    assert(
      /^#[^#]/.test(jetpack.read(manualRelativePath)),
      `Manual '${manualRelativePath}' must begin with a single '#'`
    );
  }
}

module.exports = { getDeclaredManuals, getAllManuals, checkManuals };
