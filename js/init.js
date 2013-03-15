/*global requirejs:false, require:false, document:false, window:false*/

// Configure the AMD module loader
requirejs.config({
  // The path where your JavaScripts are located
  baseUrl: '/js/',

  // Specify the paths of vendor libraries
  paths: {
    jquery:            'components/jquery/jquery.min',
    underscore:        'components/lodash/lodash.underscore.min',
    backbone:          'components/backbone/backbone-min',
    text:              'components/requirejs-text/text',
    chaplin:           'components/chaplin/amd/chaplin.min',
    bootstrap:         'components/bootstrap/amd/main'
  },

  // Underscore and Backbone are not AMD-capable per default,
  // so we need to use the AMD wrapping of RequireJS
  shim: {
    underscore: {
      exports: '_'
    },
    backbone: {
      deps: ['underscore', 'jquery'],
      exports: 'Backbone'
    }
  },

  // For easier development, disable browser caching
  // Of course, this should be removed in a production environment
  urlArgs: 'bust=' + (new Date()).getTime()
})

// load shims and polyfills
require([
  'components/es5-shim/es5-shim.min',
  'components/json2/json2'
], function() {
  var match  = document.location.href.match(/#(.+)/)
    , anchor = !!match ? match[1] : null

  if (anchor) {
    document.location.href = document.location.href.replace('#' + anchor, '#')
    window.anchor          = anchor
  }

  // load the actual application + jquery
  require([
    'sequelize',
    'jquery'
  ], function(Sequelize) {
    // load jquery plugins
    require([
      'components/jquery/jquery-migrate.min',
      'components/jquery-serialize-object/jquery.serialize-object',
      'components/jquery.cookie/jquery.cookie',
      'components/jquery_viewport/jquery.viewport'
    ], function() {
      new Sequelize().initialize()
    })
  })
})
