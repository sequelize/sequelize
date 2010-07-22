describe('Sequelize', function() {
  before(function() {
    var mapper = new Sequelize('sequelize_test', 'test', 'test')
  })
  
  describe("tableNames", function() {
    it("should return the registered table names", function() {
      var Day = mapper.define('Day', { name: mapper.STRING })
      expect(mapper.tableNames.length).toEqual(1)
    })
  })
  
  describe('schema definition', function() {
    before(function() {
      var Day = mapper.define('Day', { name: mapper.STRING })
    })

    it("should return a proper object", function() {
      expect(Day.attributes).toBeDefined()
      expect(Day.attributes).toMatch({ name: mapper.STRING })
    })
    
    it("should save the new schema in tables variable", function() {
      expect(mapper.tables.Day).toBeDefined()
    })
  })
  
  describe('object', function() {
    it("should only use passed values if specified before in schema", function() {
      var Day = mapper.define('Day', { name: mapper.STRING })
      var day = new Day({ name: 'Monday', foo: 'bar' })
      
      expect(day.name).toBeDefined()
      expect(day.name).toEqual('Monday')
      expect(day.foo).toBeUndefined()
    })
  })
  
  describe("object.save", function() {
    it("should do smth", function() {
      var Day = mapper.define('Day', { name: mapper.STRING })
      var day = new Day({ name: 'Monday', foo: 'bar' })
      day.save()
    })
  })
})