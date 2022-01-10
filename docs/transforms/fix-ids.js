'use strict';

const _ = require('lodash');
const assert = require('assert');

module.exports = function transform($, filePath) {
  // The rest of this script assumes forward slashes, so let's ensure this works on windows
  filePath = filePath.replace(/\\/g, '/');

  // Detect every heading with an ID
  const headingsWithId = $('h1,h2,h3,h4,h5').filter('[id]');

  // Find duplicate IDs among them
  const headingsWithDuplicateId = _.chain(headingsWithId)
    .groupBy(h => $(h).attr('id'))
    .filter(g => g.length > 1)
    .value();

  // Replace their IDs according to the following rule
  // #original-header --> #original-header
  // #original-header --> #original-header-2
  // #original-header --> #original-header-3
  for (const headingGroup of headingsWithDuplicateId) {
    const id = $(headingGroup[0]).attr('id');

    // Find the corresponding nav links
    const urlPath = filePath.replace('esdoc/', '');
    const navLinks = $(`li[data-ice="manualNav"] > a[href="${urlPath}#${id}"]`);

    // make sure there are same number of headings and links
    assert(headingGroup.length === navLinks.length,
      `not every heading is linked to in nav:
      ${headingGroup.length} headings but ${navLinks.length} links
      heading id is ${id} in file ${filePath}. NavLinks is ${require('util').inspect(navLinks, { compact: false, depth: 5 })}`);

    // Fix the headings and nav links beyond the first
    for (let i = 1; i < headingGroup.length; i++) {
      const heading = headingGroup[i];
      const navLink = navLinks[i];
      const newId = `${id}-${i + 1}`;
      $(heading).attr('id', newId);
      $(navLink).attr('href', `${urlPath}#${newId}`);
    }
  }

};
