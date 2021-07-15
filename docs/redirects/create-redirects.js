'use strict';

const jetpack = require('fs-jetpack');
const redirectMap = require('./../redirects.json');

function makeBoilerplate(url) {
  return `
    <!DOCTYPE html>
    <meta charset="utf-8">
    <title>Redirecting...</title>
    <meta http-equiv="refresh" content="0; URL=${url}">
    <link rel="canonical" href="${url}">
  `;
}

for (const source of Object.keys(redirectMap)) {
  jetpack.write(`esdoc/${source}`, makeBoilerplate(redirectMap[source]));
}