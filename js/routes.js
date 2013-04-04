/*global define:false*/

define(function() {
  'use strict';

  return function(match) {
    match('',              'home#index')
    match('documentation', 'documentation#index')
    match('changelog',     'changelog#index')
    match('heroku',        'pages#heroku')
  }
})
