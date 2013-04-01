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

        this.renderedSections = []

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
        this.renderMiniBrowsers()
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
      var $window      = $(window)
        , $body        = $('body')
        , $nav         = $('.subnav')
        , navHeight    = $('.navbar').first().height()
        , subnavHeight = $nav.first().height()
        , marginTop    = parseInt($body.css('margin-top'), 10)

      var processScroll = function(nav, subnavTop, sectionBottom, isFixed) {
        var scrollTop = $window.scrollTop()

        if (((scrollTop >= subnavTop) && (scrollTop <= sectionBottom)) && !isFixed) {
          isFixed = true
          nav.addClass('subnav-fixed')
          $body.css('margin-top', marginTop + subnavHeight + 'px')
        } else if (((scrollTop <= subnavTop) || (scrollTop >= sectionBottom)) && isFixed) {
          isFixed = false
          nav.removeClass('subnav-fixed')
          $body.css('margin-top', marginTop + 'px')
        }

        return isFixed
      }

      $nav.each(function() {
        var nav           = $(this)
          , section       = nav.parents('section')
          , subnavTop     = nav.length && nav.offset().top - navHeight
          , sectionBottom = section.offset().top + section.height()
          , isFixed       = processScroll(nav, subnavTop, sectionBottom, false)

        $window.scroll(function() {
          isFixed = processScroll(nav, subnavTop, sectionBottom, isFixed)
        })
      })
    },

    jumpToAnchor: function() {
      if (!!window.anchor && !!document.location.href.match(/#$/)) {
        document.location.href = document.location.href.replace('#', '#' + window.anchor)
      }
    },

    renderMiniBrowsers: function() {
      $('.mini-browser').each(function() {
        var $browser = $(this)

        $browser
          .append($('<img src="/img/mini-browser.png">'))
          .css('background', 'transparent url(' + $browser.data('img-url') + ') no-repeat left 42px')
      })

    }
  })
})
