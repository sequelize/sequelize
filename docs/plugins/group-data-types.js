'use strict';

const path = require('path');
const cheerio = require('cheerio');

function groupDataTypes($) {
  let firstLi;
  $('nav a').each(function() {
    /* eslint-disable no-invalid-this */
    if ($(this).attr('href').startsWith('class/lib/data-types.js~')) {
      const li = $(this).closest('li');
      if (!firstLi) {
        firstLi = li;
        firstLi.prepend('<a data-ice="dirPath" class="nav-dir-path" href="variable/index.html#static-variable-DataTypes">datatypes</a>');
        firstLi.appendTo(firstLi.parent());
      } else {
        firstLi.after(li);
      }
    }
  });
}

class GroupDataTypesPlugin {
  onHandleContent(ev) {
    if (path.extname(ev.data.fileName) !== '.html') return;

    const $ = cheerio.load(ev.data.content);

    groupDataTypes($);

    $('nav li[data-ice=doc]:first-child').css('margin-top', '15px');

    ev.data.content = $.html();
  }
}

module.exports = new GroupDataTypesPlugin();