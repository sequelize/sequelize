require(__dirname + "/../sequelize")

var s = new Sequelize('sequelize_test', 'test', 'test', {disableLogging: true})
var Day = s.define('Day', { name: Sequelize.TEXT })

module.exports = {
  'constructor': function(assert) {
    assert.eql(Day.associations, [])
    assert.eql(Day.attributes, {"name":"VARCHAR(4000)","createdAt":"DATETIME NOT NULL","updatedAt":"DATETIME NOT NULL"})
    assert.eql(Day.tableName, 'Days')
  },
  'new': function(assert) {
    var day = new Day({name: 'asd'})
    assert.isNull(day.id)
    assert.eql(day.table, Day)
    assert.eql(day.name, 'asd')
    assert.isUndefined(new Day({name: 'asd', bla: 'foo'}).bla)
  },
  'isCrossAssociatedWith': function(assert) {
    var Foo = s.define('Foo', { bla: Sequelize.TEXT })
    assert.equal(Foo.isCrossAssociatedWith(Day), false)
    Foo.hasMany('days', Day)
    assert.equal(Foo.isCrossAssociatedWith(Day), false)
    Day.hasMany('foos', Foo)
    assert.equal(Foo.isCrossAssociatedWith(Day), true)
  },
  'prepareAssociations belongsTo': function(assert) {
    var Me = s.define('Me', {})
    var You = s.define('You', {})
    You.belongsTo('me', Me)
    
    Me.prepareAssociations()
    You.prepareAssociations()

    assert.includes(SequelizeHelper.Hash.keys(You.attributes), 'meId')
    assert.isNotUndefined(You.attributes.meId)
    assert.isNotNull(You.attributes.meId)
  },
  'prepareAssociations hasOne': function(assert) {
    var Me = s.define('Me2', {})
    var You = s.define('You2', {})
    You.hasOne('me', Me)
    
    Me.prepareAssociations()
    You.prepareAssociations()

    assert.includes(SequelizeHelper.Hash.keys(Me.attributes), 'you2Id')
    assert.isNotUndefined(Me.attributes.you2Id)
    assert.isNotNull(Me.attributes.you2Id)
  },
  'prepareAssociations hasMany': function(assert) {
    var ManyToManyPart1 = s.define('ManyToManyPart1', {})
    var ManyToManyPart2 = s.define('ManyToManyPart2', {})
    ManyToManyPart1.hasMany('manyToManyPart1', ManyToManyPart2)
    ManyToManyPart2.hasMany('manyToManyPart1', ManyToManyPart1)

    ManyToManyPart1.prepareAssociations()
    ManyToManyPart2.prepareAssociations()

    assert.isUndefined(ManyToManyPart1.attributes.manyToManyPart2Id)
    assert.isUndefined(ManyToManyPart2.attributes.manyToManyPart1Id)

    assert.isNotUndefined(s.tables.ManyToManyPart1sManyToManyPart2s)
  },
  'sync should return the table class': function(assert, beforeExit) {
    var toBeTested = null
    Day.sync(function(_Day) { toBeTested = _Day })
    beforeExit(function() { assert.eql(toBeTested, Day) })
  },
  'drop should return the table class': function(assert, beforeExit) {
    var toBeTested = null
    Day.drop(function(_Day) { toBeTested = _Day })
    beforeExit(function() { assert.eql(toBeTested, Day) })
  },
  'findAll should return all items as class objects': function(assert, beforeExit) {
    var allFindAllTestItems = null
    var FindAllTest = s.define('FindAllTest', {})

    FindAllTest.drop(function() {
      FindAllTest.sync(function() {
        new FindAllTest({}).save(function() {
          new FindAllTest({}).save(function() {
            FindAllTest.findAll(function(findAlls) {
              allFindAllTestItems = findAlls
            })
          })
        })
      })
    })
    
    beforeExit(function(){
      assert.equal(allFindAllTestItems.length, 2)
      allFindAllTestItems.forEach(function(item) {
        assert.equal(item instanceof FindAllTest, true)
      })
    })
  },
  'find returns the correct item': function(assert, beforeExit) {
    var item = null
    var itemToMatch = null
    var FindTest = s.define('FindTest', { name: Sequelize.STRING })
    FindTest.drop(function() {
      FindTest.sync(function() {
        itemToMatch = new FindTest({name: 'foo'})
        itemToMatch.save(function() {
          new FindTest({name: 'bar'}).save(function() {
            FindTest.find({name: 'foo'}, function(result) {
              item = result
            })
          })
        })
      })
    })
    
    beforeExit(function() {
      assert.equal(itemToMatch.id, item.id)
      assert.equal(itemToMatch.name, item.name)
    })
  },
  'sqlResultToObject returns the correct object': function(assert) {
    var SqlResultToObjectTest = s.define('SqlResultToObject', {name: Sequelize.STRING})
    var toBeTested = SqlResultToObjectTest.sqlResultToObject({
      id: 1,
      name: 'foo'
    })
    assert.equal(toBeTested instanceof SqlResultToObjectTest, true)
    assert.equal(toBeTested.id, 1)
    assert.equal(toBeTested.name, 'foo')
  },
  'hasMany': function(assert) {
    var HasManyBlubb = s.define('HasManyBlubb', {})
    Day.hasMany('HasManyBlubbs', HasManyBlubb)
    assert.isNotUndefined(new Day({name:''}).HasManyBlubbs)
  },
  'hasMany: set association': function(assert, beforeExit) {
    var assoc = null
    var Character = s.define('Character', {})
    var Word = s.define('Word', {})
    Character.hasMany('Words', Word)
    Word.hasMany('Characters', Character)

    Sequelize.chainQueries([
      {drop: Character}, {drop: Word}, {prepareAssociations: Word}, {prepareAssociations: Character}, {sync: Word}, {sync: Character}
    ],
    function() {
      var Association = s.tables.CharactersWords.klass
      Association.sync(function() {
        var w = new Word()
        var c1 = new Character()
        var c2 = new Character()
        Sequelize.chainQueries([{save: w}, {save: c1}, {save: c2}], function() {
          w.setCharacters([c1, c2], function(associations) {
            assoc = associations
          })
        })
      })
    })
    
    beforeExit(function() {
      assert.isNotNull(assoc)
      assert.equal(assoc.length, 2)
    })
  },
  'hasOne': function(assert) {
    var HasOneBlubb = s.define('HasOneBlubb', {})
    Day.hasOne('HasOneBlubb', HasOneBlubb)
    assert.isNotUndefined(new Day({name:''}).HasOneBlubb)
  },
  'hasOne set association': function(assert, beforeExit) {
    var s2 = new Sequelize('sequelize_test', 'test', 'test', {disableLogging: true})
    var Task = s2.define('Task', {title: Sequelize.STRING})
    var Deadline = s2.define('Deadline', {date: Sequelize.DATE})
    
    Task.hasOne('deadline', Deadline)
    Deadline.belongsTo('task', Task)

    var task = new Task({ title:'do smth' })
    var deadline = new Deadline({date: new Date()})
    var assertMe = null
    
    Sequelize.chainQueries([{sync: s2}, {drop: s2}, {sync: s2}, {save: task}, {save: deadline}], function() {
      task.setDeadline(deadline, function(_deadline) { assertMe = _deadline })
    })
    
    beforeExit(function() {
      assert.isNotNull(assertMe)
      assert.eql(assertMe, deadline)
    })
  },
  'belongsTo': function(assert) {
    var BelongsToBlubb = s.define('BelongsToBlubb', {})
    Day.belongsTo('BelongsToBlubb', BelongsToBlubb)
    assert.isNotUndefined(new Day({name:''}).BelongsToBlubb)
  },
  'belongsTo: set association': function(assert, beforeExit) {
    var s2 = new Sequelize('sequelize_test', 'test', 'test', {disableLogging: true})
    var Task = s2.define('Task', {title: Sequelize.STRING})
    var Deadline = s2.define('Deadline', {date: Sequelize.DATE})
    
    Task.hasOne('deadline', Deadline)
    Deadline.belongsTo('task', Task)

    var task = new Task({ title:'do smth' })
    var deadline = new Deadline({date: new Date()})
    var assertMe = null
    
    Sequelize.chainQueries([{drop: s2}, {sync: s2}, {save: task}, {save: deadline}], function() {
      deadline.setTask(task, function(_task) { assertMe = _task })
    })
    
    beforeExit(function() {
      assert.isNotNull(assertMe)
      assert.eql(assertMe.id, task.id)
    })
  },
  'identifier': function(assert) {
    assert.equal(s.define('Identifier', {}).identifier, 'identifierId')
  },
  'values': function(assert) {
    var day = new Day({name: 's'})
    assert.eql(day.values, { name: "s", createdAt: null, updatedAt: null})
  },
  'save should set the id of a newly created object': function(assert, beforeExit) {
    var subject = null
    var SaveTest = s.define('SaveTest', {name: Sequelize.STRING})
    SaveTest.drop(function(){
      SaveTest.sync(function() {
         new SaveTest({name:'s'}).save(function(_saveTest){
          subject = _saveTest
        })
      })
    })
    
    beforeExit(function() {
      assert.isNotNull(subject.id)
    })
  },
  'updateAttributes should update available attributes': function(assert, beforeExit) {
    var subject = null

    Sequelize.chainQueries([{drop: Day}, {sync: Day}], function() {
      new Day({name:'Monday'}).save(function(day) {
        day.updateAttributes({name: 'Sunday', foo: 'bar'}, function(day) {
          subject = day
        })
      })
    })

    beforeExit(function() {
      assert.equal(subject.name, 'Sunday')
      assert.isUndefined(subject.foo)
    })
  },
  'destroy should make the object unavailable': function(assert, beforeExit) {
    var subject = 1
    var UpdateAttributesTest = s.define('UpdateAttributeTest', {name: Sequelize.STRING})
    Sequelize.chainQueries([{drop: UpdateAttributesTest}, {sync: UpdateAttributesTest}], function() {
      new UpdateAttributesTest({name:'Monday'}).save(function(day) {
        day.destroy(function() {
          UpdateAttributesTest.find(day.id, function(result) {
            subject = result
          })
        })
      })
    })
    beforeExit(function() {
      assert.isNull(subject)
    })
  }
}