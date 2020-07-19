'use strict';

const jetpack = require('fs-jetpack');
const cheerio = require('cheerio');

if (jetpack.exists('esdoc') !== 'dir') {
  throw new Error('./esdoc folder not found.');
}

const htmlFiles = jetpack.find('./esdoc', { matching: '*.html' });
const transformFiles = jetpack.find('./docs/transforms', { matching: '*.js' });
const transforms = transformFiles.map(file => require(jetpack.path('.', file)));

for (const htmlFile of htmlFiles) {
  console.log(`Transform: ${htmlFile}`);
  const $ = cheerio.load(jetpack.read(htmlFile));
  for (const transform of transforms) {
    transform($, htmlFile);
  }
  jetpack.write(htmlFile, $.html());
}