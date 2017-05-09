const cheerio = require('cheerio');
const esdocConfig = require('../.esdoc.json');

exports.onHandleHTML = function(ev) {
  const $ = cheerio.load(ev.data.html);

  const $title = $('head title');
  if ($title.text().indexOf(esdocConfig.title) === -1) {
    $title.text($title.text() + ' | ' + esdocConfig.title);
  }

  const $header = $('header');
  $header.prepend('<a href="/"><img src="manual/asset/logo-small.png" class="header-logo" /></a>');
  $header.append('<div class="search-container"><div class="gcse-search"></div></div>');
  $('head').append('<script type="text/javascript" async=true src="https://cse.google.com/cse.js?cx=015434599481993553871:zku_jjbxubw" />');

  $('.repo-url-github').after('<a href="http://sequelize-slack.herokuapp.com/" class="slack-link"><img class="slack-logo" src="manual/asset/slack.svg"/>Join us on Slack</a>');

  // remove unnecessary scripts
  const scripts = ['script/search_index.js', 'script/search.js', 'script/inherited-summary.js', 'script/test-summary.js', 'script/inner-link.js'];
  for (const script of scripts) {
    $(`script[src="${script}"]`).remove();
  }

  ev.data.html = $.html();
};
