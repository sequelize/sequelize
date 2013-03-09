var suite = new Benchmark.Suite,
    testDoc = {
      id: 1,
      title: 'Adding story from last story in the sprint',
      body: 'So that I am not confused where the story is going to end up As a user I want the the add a story button from the last story in the sprint to create a story at the top of the backlog and not extend the sprint temporarily the add story button inserts a story at the top of the backlog. "add a new story here" prompts are not shown for stories that are currently in a sprint'
    }

suite.add('index#add', function () {
  var idx = lunr(function () {
    this.field('title', 10)
    this.field('body')
  })

  idx.add(testDoc)
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
