var suite = new Benchmark.Suite,
    elements = [],
    fn1 = function (t) { return t },
    fn2 = function (t) { return t },
    pipeline = new lunr.Pipeline

for (var i = 0; i < 10000; i++) {
  elements[i] = Math.random() * 100
};

pipeline.add(fn1, fn2)

suite.add('pipeline#run', function () {
  pipeline.run(elements)
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

