'use strict';

module.exports = function transform($) {
  const apiReferenceLink = $('header a:nth-child(2)');
  const githubLogoImage = $('header a img[src="./image/github.png"]');

  apiReferenceLink
    .text('API Reference')
    .addClass('api-reference-link');

  githubLogoImage
    .css('width', '30px')
    .attr('width', '30px');

  githubLogoImage.closest('a')
    .css('position', '')
    .css('top', '')
    .after(`
      <a href="http://sequelize-slack.herokuapp.com/">
        <img src="manual/asset/slack.svg" style="width: 60px; margin-left: -15px;" />
      </a>
    `);
};
