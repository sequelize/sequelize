'use strict';

function groupDataTypes($, path) {
  let firstLi;
  $('nav a').each(function() {
    /* eslint-disable no-invalid-this */
    if ($(this).attr('href').startsWith('class/src/data-types.js~')) {
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

  if (path.endsWith('identifiers.html')) {
    const rowsToDelete = [];
    $('table.summary td a').each(function() {
      if ($(this).attr('href').startsWith('class/src/data-types.js~')) {
        rowsToDelete.push($(this).closest('tr'));
      }
    });
    for (const row of rowsToDelete) {
      $(row).remove();
    }
  }
}

module.exports = function transform($, path) {
  groupDataTypes($, path);
  $('nav li[data-ice=doc]:first-child').css('margin-top', '15px');
};
