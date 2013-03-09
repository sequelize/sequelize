var suite = new Benchmark.Suite,
    elements = []

for (var i = 0; i < 1000; i++) {
  elements[i] = Math.random() * 100
};

suite.add('vector#magnitude', function () {
  var vector = new lunr.Vector (elements)
  vector.magnitude()
})

suite.add('vector#dot', function () {
  var v1 = new lunr.Vector(elements),
      v2 = new lunr.Vector(elements)

  v1.dot(v2)
})

suite.on('cycle', function (e) {
  console.log(e.target.name)
})

suite.on('complete', function (e) {
  suite.forEach(function (s) {
    console.log(s.name, s.count)
  })
})

suite.run({async: true})
