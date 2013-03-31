/*global define:false*/

define([
  'models/base/collection',
  'models/changelog'
], function(Collection, Changelog) {
  return Collection.extend({
    url: '/changelog.json',
    model: Changelog
  })
})
