if(typeof require === 'function') {
  const buster    = require("buster")
      , Sequelize = require("../../index")
      , config    = require("../config/config")
      , sequelize = new Sequelize(config.database, config.username, config.password, {logging: false})
}

buster.spec.expose()
buster.testRunner.timeout = 500

describe('Testing \'has\' function', function() {
  before(function(done) {
    var self = this

    sequelize
      .getQueryInterface()
      .dropAllTables()
      .success(function() {
        done()
      })
      .error(function(err) { console.log(err) })
  }),
  
  describe('using Article and Labels', function() {
    before(function(done) {
      var self = this
      
      this.Article = sequelize.define('Article', {
        'title': Sequelize.STRING
      })
      this.Label = sequelize.define('Label', {
        'text': Sequelize.STRING
      })
      
      this.Article.hasMany(this.Label);
      
      this.Article.sync({ force: true }).success(function() {
        self.Label.sync({ force: true }).success(done).error(function(err) {
          console.log(err)
        })
      }).error(function(err) {
        console.log(err)
      })
    }),
    
	 describe('hasSingle', function() {
		it('does not have any labels assigned to it initially', function(done) {
			var self = this;
			
			this.Article.create({
				title: 'Article'
			}).success(function(article) {
				self.Label.create({
					text: 'Awesomeness'
				}).success(function(label1) {
					self.Label.create({
						text: 'Epicness'
					}).success(function(label2) {
						article.hasLabel(label1).success(function(result) {
							expect(result).toBeFalse();
							
							article.hasLabel(label2).success(function(result) {
								expect(result).toBeFalse();
								done();
							});
						});
					});
				});
			});
		 }),
		 
		 it('only answers true if the label has been assigned', function(done) {
			var self = this;
			
			this.Article.create({
				title: 'Article'
			}).success(function(article) {
				self.Label.create({
					text: 'Awesomeness'
				}).success(function(label1) {
					self.Label.create({
						text: 'Epicness'
					}).success(function(label2) {
						article.addLabel(label1).success(function() {
							article.hasLabel(label1).success(function(result) {
								expect(result).toBeTrue();
								
								article.hasLabel(label2).success(function(result) {
									expect(result).toBeFalse();
									done();
								});
							});
						})
					});
				});
			});
		 })
	 }),
	 
	 describe('hasAll', function() {
		it('answers false if only some labels have been assigned', function(done) {
			var self = this;
			
			this.Article.create({
				title: 'Article'
			}).success(function(article) {
				self.Label.create({
					text: 'Awesomeness'
				}).success(function(label1) {
					self.Label.create({
						text: 'Epicness'
					}).success(function(label2) {
						article.addLabel(label1).success(function() {
							article.hasLabels([label1, label2]).success(function(result) {
								expect(result).toBeFalse();
								done();
							});
						})
					});
				});
			});
		 }),
		 
		it('answers true if all label have been assigned', function(done) {
			var self = this;
			
			this.Article.create({
				title: 'Article'
			}).success(function(article) {
				self.Label.create({
					text: 'Awesomeness'
				}).success(function(label1) {
					self.Label.create({
						text: 'Epicness'
					}).success(function(label2) {
						article.setLabels([label1, label2]).success(function() {
							article.hasLabels([label1, label2]).success(function(result) {
								expect(result).toBeTrue();
								done();
							});
						})
					});
				});
			});
		 })
	 });
  })
})