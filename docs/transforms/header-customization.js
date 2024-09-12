'use strict';

module.exports = function transform($) {
  const apiReferenceLink = $('header a:nth-child(2)');
  const githubLogoImage = $('header a img[src="./image/github.png"]');

  apiReferenceLink
    .attr('href', '/docs/v6/intro/')
    .text('Guides')
    .addClass('api-reference-link');

  githubLogoImage
    .css('width', '30px')
    .attr('width', '30px');
};
