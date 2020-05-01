'use strict';

module.exports = function transform($, filePath) {

  if (!filePath.endsWith('assocs.html')) {
    return;
  }

  let target;

  // Change id of later synonymous headers
  const oneToManyHeader = $('#one-to-many-relationships');
  const manyToManyHeader = $('#many-to-many-relationships');
  
  target = oneToManyHeader.nextUntil(manyToManyHeader, '#philosophy');
  target.attr('id', 'philosophy-1');
  target = oneToManyHeader.nextUntil(manyToManyHeader, '#goal');
  target.attr('id', 'goal-1');
  target = oneToManyHeader.nextUntil(manyToManyHeader, '#implementation');
  target.attr('id', 'implementation-1');
  target = oneToManyHeader.nextUntil(manyToManyHeader, '#options');
  target.attr('id', 'options-1');

  target = manyToManyHeader.nextAll('#philosophy');
  target.attr('id', 'philosophy-2');
  target = manyToManyHeader.nextAll('#goal');
  target.attr('id', 'goal-2');
  target = manyToManyHeader.nextAll('#implementation');
  target.attr('id', 'implementation-2');
  target = manyToManyHeader.nextAll('#options');
  target.attr('id', 'options-2');

  // Change links in nav
  target = $('a[href="manual/assocs.html#philosophy"]');
  $( target.get(1) ).attr('href', 'manual/assocs.html#philosophy-1');
  $( target.get(2) ).attr('href', 'manual/assocs.html#philosophy-2');
  target = $('a[href="manual/assocs.html#goal"]');
  $( target.get(1) ).attr('href', 'manual/assocs.html#goal-1');
  $( target.get(2) ).attr('href', 'manual/assocs.html#goal-2');
  target = $('a[href="manual/assocs.html#implementation"]');
  $( target.get(1) ).attr('href', 'manual/assocs.html#implementation-1');
  $( target.get(2) ).attr('href', 'manual/assocs.html#implementation-2');
  target = $('a[href="manual/assocs.html#options"]');
  $( target.get(1) ).attr('href', 'manual/assocs.html#options-1');
  $( target.get(2) ).attr('href', 'manual/assocs.html#options-2');
};
