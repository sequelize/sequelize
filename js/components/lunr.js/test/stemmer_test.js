module('lunr.stemmer')

test('should stem words correctly', function () {
  Object.keys(stemmingFixture).forEach(function (testWord) {
    var expected = stemmingFixture[testWord]

    equal(lunr.stemmer(testWord), expected)
  })
})
