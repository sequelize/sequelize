'use strict';

const cheerio = require('cheerio');
const esdocConfig = require('../../.esdoc.json');

exports.onHandleHTML = function(ev) {
  const $ = cheerio.load(ev.data.html);

  const $title = $('head title');
  if ($title.text().indexOf(esdocConfig.title) === -1) {
    $title.text($title.text() + ' | ' + esdocConfig.title);
  }

  $('head').append('<link rel="shortcut icon" type="image/x-icon" href="favicon.ico" />');

  const $header = $('header');
  $header.prepend('<a href="/"><img src="manual/asset/logo-small.png" class="header-logo" /></a>');
  $('.repo-url-github').after('<a href="http://sequelize-slack.herokuapp.com/" class="slack-link"><img class="slack-logo" src="manual/asset/slack.svg"/>Join us on Slack</a>');

  // remove unnecessary scripts
  const scripts = ['script/search_index.js', 'script/search.js', 'script/inherited-summary.js', 'script/test-summary.js', 'script/inner-link.js'];
  for (const script of scripts) {
    $(`script[src="${script}"]`).remove();
  }

  // Algolia search
  if (process.env.ALGOLIA_API_KEY) {
    $('head').append('<link rel="stylesheet" href="https://cdn.jsdelivr.net/docsearch.js/2/docsearch.min.css" />');
    $header.append('<div class="docs-search-container"><input type="search" id="docs-search-input" placeholder="Search..."></div>');
    $('body').append(`
      <script type="text/javascript" src="https://cdn.jsdelivr.net/docsearch.js/2/docsearch.min.js"></script>
      <script type="text/javascript">
        docsearch({
          apiKey: '${process.env.ALGOLIA_API_KEY}',
          indexName: 'sequelizejs',
          inputSelector: '#docs-search-input',
          debug: false // Set debug to true if you want to inspect the dropdown
        });
        document.getElementById('docs-search-input').focus();
      </script>
    `);
  } else {
    console.log('Set ALGOLIA_API_KEY environment variable to enable Algolia search field');
  }

  ev.data.html = $.html();
};
