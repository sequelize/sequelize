/*global define:false, Prism:false, window:false, require:false, document:false*/

define([
  'chaplin',
  'views/base/view',
  'text!templates/documentation/index.html',
  'jquery',
  'lib/view_helper'
], function(Chaplin, View, template, $, ViewHelper) {
  'use strict';

  return View.extend({
    template:         template,
    className:        'documentation index',
    renderedSections: [],

    listen: {
      'rendered': function() {
        // get all sections on the page and create an array with the paths to its templates
        var ids       = this.$('section').map(function() { return $(this).attr('id') }).toArray()
          , filenames = ids.map(function(id) { return 'text!templates/documentation/sections/' + id + '.html' })

        // require the templates ...
        require(filenames, function() {
          var templates = arguments

          // ... in assign the html to the DOM
          ids.forEach(function(id, i) {
            this.renderSection(id, $(templates[i]))
          }.bind(this))
        }.bind(this))
      },

      'section_rendered': function() {
        if (this.$('section').length === this.renderedSections.length) {
          Chaplin.mediator.publish('documentation.index.rendered')
        }
      },

      'documentation.index.rendered mediator': function() {
        this.enableCodeHighlighting()
        this.enableScrollSpy()
        this.enableSubNavs()
        this.jumpToAnchor()
      }
    },

    renderSection: function(id, html) {
      html = ViewHelper.fixCodeIndentation(html)
      $('section#' + id).html(html)

      window.setTimeout(function() {
        this.renderedSections.push(id)
        this.trigger('section_rendered')
      }.bind(this), 50)
    },

    enableCodeHighlighting: function() {
      Prism.highlightAll()
    },

    enableScrollSpy: function() {
      $('[data-spy="scroll"]').each(function () {
        $(this).scrollspy('refresh')
      })
    },

    enableSubNavs: function() {
      // fix sub nav on scroll
      var $win = $(window)
        , $body = $('body')
        , $nav = $('.subnav')
        , navHeight = $('.navbar').first().height()
        , subnavHeight = $('.subnav').first().height()
        , subnavTop = $('.subnav').length && $('.subnav').offset().top - navHeight
        , marginTop = parseInt($body.css('margin-top'), 10)
        , isFixed = 0

      processScroll();

      $win.on('scroll', processScroll);

      function processScroll() {
        var scrollTop = $win.scrollTop();

        if (scrollTop >= subnavTop && !isFixed) {
          isFixed = 1;
          $nav.addClass('subnav-fixed');
          $body.css('margin-top', marginTop + subnavHeight + 'px');
        } else if (scrollTop <= subnavTop && isFixed) {
          isFixed = 0;
          $nav.removeClass('subnav-fixed');
          $body.css('margin-top', marginTop + 'px');
        }
      }
    },

    jumpToAnchor: function() {
      if (!!window.anchor && !!document.location.href.match(/#$/)) {
        document.location.href = document.location.href.replace('#', '#' + window.anchor)
      }
    }
  })
})
