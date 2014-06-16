
var Sequelize = require(__dirname + "/../lib/sequelize")
var chai      = require('chai')
var expect    = chai.expect

describe.only('Bug when selecting Sequelize.literal(..) as attribute from model that is attached to query include array', function () {

	it("Should not throw error related to invalid attribute",function(done){
		
		var sequelize = new Sequelize()
		var Post = sequelize.define('User',{})
		var PostComment = sequelize.define('PostComment',{})
		
		Post.hasMany(PostComment)
		
		try {
			Post.findAll({
				include: [
					{ model: PostComment }
				],
				attributes: [Sequelize.literal('EXISTS(SELECT 1) AS "PostComment.someProperty"')]
			})
		} catch(err) {
			// if any errors occured it should not be related to literal attribute
			if(err){
				expect(err.message).not.to.be.equal("Object EXISTS(SELECT 1) AS \"PostComment.someProperty\" has no method 'replace'")
			}
		}
		
		done()
		
	}) // it

	it("Should not throw error related to invalid attribute",function(done){
		
		var sequelize = new Sequelize()
		var Post = sequelize.define('User',{})
		var PostComment = sequelize.define('PostComment',{})
		
		Post.hasMany(PostComment)
		
		try {
			Post.findAll({
				include: [
					{ model: PostComment, attributes: [Sequelize.literal('EXISTS(SELECT 1) AS "PostComment.someProperty"')] }
				]	
			})
		} catch(err) {
			// if any errors occured it should not be related to literal attribute
			if(err){
				expect(err.message).not.to.be.equal("Object EXISTS(SELECT 1) AS \"PostComment.someProperty\" has no method 'replace'")
			}
		}
		
		done()
		
	}) // it

}) // describe
