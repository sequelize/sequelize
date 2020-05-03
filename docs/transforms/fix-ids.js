'use strict';

const _ = require('lodash');
const assert = require('assert');

module.exports = function transform($, filePath) {

  // Detect every heading with an ID
  const headingsWithId = $('h1,h2,h3,h4,h5').filter('[id]');

  // Find duplicate IDs among them
  const headingsWithDuplicateId = _.chain(headingsWithId)
    .groupBy(h => $(h).attr('id'))
    .filter(g => g.length > 1)
    .value();

  // console.log(headingsWithDuplicateId);

  // Replace their IDs with the following rule
  // #original-header --> #original-header
  // #original-header --> #original-header-2
  // #original-header --> #original-header-3
  for (const group of headingsWithDuplicateId) {
    const id = $(group[0]).attr('id');

    // Fix the headings
    for (const ith in group) {
      const heading = group[ith];
      if (ith > 0) {
        const newId = `${id}-${Number(ith) + 1}`;
        $(heading).attr('id', newId);
      }
    }

    // Find the corresponding nav links
    const urlPath = filePath.replace('esdoc/', '');
    const navLinks = $(`li[data-ice="manualNav"] > a[href="${urlPath}#${id}"]`);
    // console.log(navLinks);

    // make sure there are same number of headings and links
    assert(group.length === navLinks.length,
      `not every heading is linked to in nav:
      ${group.length} headings but ${navLinks.length} links
      heading id is ${id} in file ${filePath}`);

    // Fix the nav links
    for (const ith in navLinks) {
      const link = navLinks[ith];
      if (ith > 0) {
        const newId = `${id}-${Number(ith) + 1}`;
        $(link).attr('href', `${urlPath}#${newId}`);
      }
    }
  }
};
