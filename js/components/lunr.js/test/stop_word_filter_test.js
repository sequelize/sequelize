module('lunr.stopWordFilter')

test('stops stop words', function () {
  var stopWords = ['the', 'and', 'but', 'than', 'when']

  stopWords.forEach(function (word) {
    equal(lunr.stopWordFilter(word), undefined)
  })
})

test('non stop words pass through', function () {
  var nonStopWords = ['interesting', 'words', 'pass', 'through']

  nonStopWords.forEach(function (word) {
    equal(lunr.stopWordFilter(word), word)
  })
})
