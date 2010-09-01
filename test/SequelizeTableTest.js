var Sequelize = require(__dirname + "/../lib/sequelize/Sequelize").Sequelize
var s = new Sequelize('sequelize_test', 'test', 'test', {disableLogging: true})
var Day = s.define('Day', { name: Sequelize.TEXT })

module.exports = {
  'constructor': function(assert) {
    assert.eql(Day.associations, [])
    assert.eql(Day.attributes, {"name": {type: "TEXT"},"createdAt": {type: "DATETIME", allowNull: false},"updatedAt": {type: "DATETIME", allowNull: false}})
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
    var s = new Sequelize('sequelize_test', 'test', 'test', {disableLogging: true})
    var Me = s.define('Me', {})
    var You = s.define('You', {})
    You.belongsTo('me', Me)
    
    Me.prepareAssociations()
    You.prepareAssociations()

    assert.includes(Sequelize.Helper.Hash.keys(You.attributes), 'meId')
    assert.isDefined(You.attributes.meId)
    assert.isNotNull(You.attributes.meId)
  },
  'prepareAssociations hasOne': function(assert) {
    var Me = s.define('Me2', {})
    var You = s.define('You2', {})
    You.hasOne('me', Me)
    
    Me.prepareAssociations()
    You.prepareAssociations()

    assert.includes(Sequelize.Helper.Hash.keys(Me.attributes), 'you2Id')
    assert.isDefined(Me.attributes.you2Id)
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

    assert.isDefined(s.tables.ManyToManyPart1sManyToManyPart2s)
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

    Sequelize.chainQueries([
      {drop: FindAllTest}, {sync: FindAllTest}, {save: new FindAllTest({})}, {save: new FindAllTest({})}
    ], function() {
      FindAllTest.findAll(function(findAlls) {
        allFindAllTestItems = findAlls
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
  'find returns data in correct attributes': function(assert, beforeExit) {
    var assertMe = null
    var FindMeNow = s.define('FindMeNow', { title: Sequelize.STRING, content: Sequelize.TEXT })
    FindMeNow.drop(function() {
      FindMeNow.sync(function() {
        new FindMeNow({title: 'a title', content: 'a content'}).save(function(blubb) {
          assertMe = blubb
        })
      })
    })
    beforeExit(function() {
      assert.isNotNull(assertMe)
      assert.equal(assertMe.title, 'a title')
      assert.equal(assertMe.content, 'a content')
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
    assert.isDefined(new Day({name:''}).HasManyBlubbs)
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
    var s = new Sequelize('sequelize_test', 'test', 'test', {disableLogging: true})
    var Day = s.define('Day2', { name: Sequelize.TEXT })
    var HasOneBlubb = s.define('HasOneBlubb', {})
    Day.hasOne('HasOneBlubb', HasOneBlubb)
    assert.isDefined(new Day({name:''}).HasOneBlubb)
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
      task.setDeadline(deadline, function(_deadline) {
        assertMe = _deadline
      })
    })
    
    beforeExit(function() {
      assert.isNotNull(assertMe)
      assert.eql(assertMe, deadline)
    })
  },
  'belongsTo': function(assert) {
    var BelongsToBlubb = s.define('BelongsToBlubb', {})
    Day.belongsTo('BelongsToBlubb', BelongsToBlubb)
    assert.isDefined(new Day({name:''}).BelongsToBlubb)
  },
  'belongsTo: set association': function(assert, beforeExit) {
    var s2 = new Sequelize('sequelize_test', 'test', 'test', {disableLogging: true})
    var Task = s2.define('Task', {title: Sequelize.STRING})
    var Deadline = s2.define('Deadline', {date: Sequelize.DATE})
    var allowExit = false
    
    Task.hasOne('deadline', Deadline)
    Deadline.belongsTo('task', Task)

    var task = new Task({ title:'do smth' })
    var deadline = new Deadline({date: new Date()})
    
    Sequelize.chainQueries([{drop: s2}, {sync: s2}], function() {
      task.save(function() {
        deadline.save(function() {
          assert.isDefined(deadline.id)
          assert.isNotNull(deadline.id)
          deadline.setTask(task, function(_task) {
            assert.isNotNull(_task)
            assert.eql(_task.id, task.id)
            allowExit = true
          })
        })
      })
    })
    
    beforeExit(function() {
      assert.equal(allowExit, true)
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
    var UpdateMe = s.define('UpdateMe', {name: Sequelize.STRING})
    Sequelize.chainQueries([{drop: UpdateMe}, {sync: UpdateMe}], function() {
      new UpdateMe({name:'Monday'}).save(function(u) {
        u.updateAttributes({name: 'Sunday', foo: 'bar'}, function(u) {
          subject = u
        })
      })
    })

    beforeExit(function() {
      assert.isNotNull(subject)
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
  },
  'isAssociatedWith': function(assert, beforeExit) {
    var IsAssociatedWithTestOne = s.define("IsAssociatedWithTestOne", {})
    var IsAssociatedWithTestTwo = s.define("IsAssociatedWithTestTwo", {})
    
    IsAssociatedWithTestOne.belongsTo('foo', IsAssociatedWithTestTwo)
    assert.equal(true, IsAssociatedWithTestOne.isAssociatedWith(IsAssociatedWithTestTwo))
    assert.equal(true, IsAssociatedWithTestOne.isAssociatedWith(IsAssociatedWithTestTwo, 'belongsTo'))
    assert.equal(false, IsAssociatedWithTestOne.isAssociatedWith(IsAssociatedWithTestTwo, 'hasMany'))
    assert.equal(false, IsAssociatedWithTestOne.isAssociatedWith(IsAssociatedWithTestTwo, 'hasOne'))
  },
  'boolean ==> save': function(assert, beforeExit) {
    var BooleanTest = s.define("BooleanTest", {flag: Sequelize.BOOLEAN})
    var testIsFinished = false
    BooleanTest.sync(function() {
      new BooleanTest({flag: true}).save(function(obj) {
        assert.equal(obj.flag, true)
        obj.updateAttributes({flag: false}, function(obj2) {
          assert.equal(obj2.flag, false)
          testIsFinished = true
        })
      })
    })
    beforeExit(function() { assert.equal(true, testIsFinished) })
  },
  'sync ==> failure': function(assert, beforeExit) {
    var testIsFinished = false,
        sequelizeWithInvalidCredentials = new Sequelize('foo', 'bar', 'barfoos'),
        Fail = sequelizeWithInvalidCredentials.define('Fail', {})
    
    Fail.sync(function(table, err) {
      assert.isDefined(err)
      assert.isDefined(err.message)
      testIsFinished = true
    })
    beforeExit(function() { assert.equal(testIsFinished, true) })
  },
  'drop ==> failure': function(assert, beforeExit) {
    var testIsFinished = false,
        sequelizeWithInvalidCredentials = new Sequelize('foo', 'bar', 'barfoos'),
        Fail = sequelizeWithInvalidCredentials.define('Fail', {})

    Fail.drop(function(table, err) {
      assert.isDefined(err)
      assert.isDefined(err.message)
      testIsFinished = true
    })
    beforeExit(function() { assert.equal(testIsFinished, true) })
  },
  'default values': function(assert) {
    var DefaultTest = s.define("DefaultTest", {
      aString: { type: Sequelize.STRING, allowNull: false, default: 'woot'},
      aNumber: { type: Sequelize.INTEGER, allowNull: true},
      aBoolean: { type: Sequelize.BOOLEAN, allowNull: false, default: false},
      aText: { type: Sequelize.TEXT, allowNull: true }
    }),
    instance = new DefaultTest({})

    assert.eql(instance.aString, 'woot')
    assert.isUndefined(instance.aNumber)
    assert.eql(instance.aBoolean, false)
    assert.isUndefined(instance.aText)
  }
}