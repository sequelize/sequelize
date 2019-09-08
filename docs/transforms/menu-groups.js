'use strict';

const _ = require('lodash');
const manualGroups = require('./../manual-groups.json');

module.exports = function transform($) {
  const listItems = $('nav div.manual-toc-root div[data-ice=manual]');

  $(listItems.get(0)).before(`
    <div class='manual-group'>
      <a href='index.html' style='color: black'>Home</a>
    </div>
  `);

  let count = 0;
  _.each(manualGroups, (manuals, groupName) => {
    $(listItems.get(count)).before(`
      <div class='manual-group' style='pointer-events: none'>
        ${groupName}
      </div>
    `);
    count += manuals.length;
  });
};