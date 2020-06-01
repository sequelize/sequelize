'use strict';

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const manualGroups = require('./../manual-groups.json');

function extractFileNameFromPath(path) {
  if (/\.\w+$/.test(path)) {
    return /([^/]*)\.\w+$/.exec(path)[1];
  }
  return /[^/]*$/.exec(path)[0];
}

const hiddenManualNames = manualGroups.__hidden__.map(extractFileNameFromPath);

function isLinkToHiddenManual(link) {
  const linkTargetName = extractFileNameFromPath(link);
  return hiddenManualNames.includes(linkTargetName);
}

module.exports = function transform($, filePath) {
  // The three <span>s are used to draw the menu button icon
  $('nav.navigation').prepend($('<button id="navigationHamburger" class="hamburger" type="button"><span class="line"></span><span class="line"></span><span class="line"></span></button>'));
  const menuGroupsScripts = fs.readFileSync(path.join(__dirname, '..', 'scripts', 'menu-groups.js'), 'utf8');
  $('body').append($(`<script>${menuGroupsScripts}</script>`));

  const sidebarManualDivs = $('nav div.manual-toc-root div[data-ice=manual]');

  $(sidebarManualDivs.get(0)).before(`
    <div class='manual-group'>
      <a href='index.html' style='color: black'>Home</a>
    </div>
  `);

  let count = 0;
  _.each(manualGroups, (manuals, groupName) => {
    if (groupName !== '__hidden__') {
      const groupTitleElement = $(`<div class="manual-group no-mouse">${groupName}</div>`);
      $(sidebarManualDivs.get(count)).before(groupTitleElement);
    }
    count += manuals.length;
  });

  // Remove links to hidden manuals
  sidebarManualDivs.each(/* @this */ function() {
    const link = $(this).find('li.indent-h1').data('link');
    if (isLinkToHiddenManual(link)) {
      $(this).remove();
    }
  });

  // Remove previews for hidden manuals in index.html
  if (filePath.endsWith('index.html') && $('div.manual-cards').length > 0) {
    $('div.manual-card-wrap').each(/* @this */ function() {
      const link = $(this).find('a').attr('href');
      if (isLinkToHiddenManual(link)) {
        $(this).remove();
      }
    });
  }
};