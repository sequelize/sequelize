/*global define:false, document:false, window:false*/

define([
  'chaplin',
  'views/layout',
  'routes'
], function(Chaplin, Layout, routes) {
  'use strict';

  return Chaplin.Application.extend({
    title: 'Sequelize',

    initialize: function() {
      // Call the parent constructor.
      Chaplin.Application.prototype.initialize.apply(this, arguments)

      // Initialize core components
      this.initDispatcher()
      this.initLayout()
      this.initMediator()

      // Application-specific scaffold
      this.initControllers()

      // Register all routes and start routing
      this.initRouter(routes, { pushState: true })
      // You might pass Router/History options as the second parameter.
      // Chaplin enables pushState per default and Backbone uses / as
      // the root per default. You might change that in the options
      // if necessary:
      // this.initRouter(routes, { pushState: false , root: '/subdir/' })

      // Freeze the application instance to prevent further changes
      if (Object.freeze) {
        Object.freeze(this)
      }
    },

    // Override standard layout initializer
    // ------------------------------------
    initLayout: function() {
      this.layout = new Layout({ title: this.title })
    },

    // Instantiate common controllers
    // ------------------------------
    initControllers: function() { },

    // Create additional mediator properties
    // -------------------------------------
    initMediator: function() {
      // Create a user property
      Chaplin.mediator.user = null
      // Add additional application-specific properties and methods
      // Seal the mediator
      Chaplin.mediator.seal()

      Chaplin.mediator.subscribe('!router:route', function() {
        var route = document.location.href.match(/http.?:\/\/.+?(\/.+)/)[1]
        window._gaq.push(['_trackPageview', route])
      })
    }
  })
})
