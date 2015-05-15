'use strict';

/* jshint -W110 */
var Support   = require(__dirname + '/../support')
  , DataTypes = require(__dirname + '/../../../lib/data-types')
  , util      = require('util')
  , Sequelize = require(__dirname + '/../../../lib/sequelize')
  , expectsql = Support.expectsql
  , current   = Support.sequelize
  , sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), function() {  
  suite('joinIncludeQuery', function () {
    var testsql = function (params, options, expectation) {
      if (expectation === undefined) {
        expectation = options;
        options = undefined;
      }

      test(util.inspect(params, {depth: 10})+(options && ', '+util.inspect(options) || ''), function () {
        return expectsql(sql.joinIncludeQuery(params, options), expectation);
      });
    };

    var User = current.define('User', {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        field: 'id_user'
      },
      companyId: {
        type: DataTypes.INTEGER,
        field: 'company_id'
      }
    }, {
      tableName: 'user'
    });
    var Task = current.define('Task', {
      title: Sequelize.STRING,
      userId: {
        type: DataTypes.INTEGER,
        field: 'user_id'
      }
    }, {
      tableName: 'task'
    });

    var Company = current.define('Company', {
      name: Sequelize.STRING,
      ownerId: {
        type: Sequelize.INTEGER,
        field: 'owner_id'
      }
    }, {
      tableName: 'company'
    });

    User.Tasks = User.hasMany(Task, {as: 'Tasks', foreignKey: 'userId'});
    User.Company = User.belongsTo(Company, {foreignKey: 'companyId'});
    Company.Employees = Company.hasMany(User, {as: 'Employees', foreignKey: 'companyId'});
    Company.Owner = Company.belongsTo(User, {as: 'Owner', foreignKey: 'ownerId'});

    /*
     * BelongsTo
     */
    testsql({
      model: User,
      subQuery: false,
      include: Sequelize.Model.$validateIncludedElements({
        model: User,
        include: [
          User.Company
        ]
      }).include[0]
    }, {
      default: "LEFT OUTER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id]"
    });

    testsql({
      model: User,
      subQuery: true,
      include: Sequelize.Model.$validateIncludedElements({
        limit: 3,
        model: User,
        include: [
          User.Company
        ]
      }).include[0]
    }, {
      default: "LEFT OUTER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id]"
    });

    testsql({
      model: User,
      subQuery: true,
      include: Sequelize.Model.$validateIncludedElements({
        limit: 3,
        model: User,
        include: [
          {association: User.Company, required: false, where: {
            name: 'ABC'
          }},
          User.Tasks
        ]
      }).include[0]
    }, {
      default: "LEFT OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id] AND [Company].[name] = 'ABC'"
    });

    testsql({
      model: User,
      subQuery: true,
      include: Sequelize.Model.$validateIncludedElements({
        limit: 3,
        model: User,
        include: [
          {association: User.Company, include: [
            Company.Owner
          ]}
        ]
      }).include[0].include[0]
    }, {
      default: "LEFT OUTER JOIN [user] AS [Owner] ON [Company].[owner_id] = [Owner].[id_user]"
    });

    testsql({
      model: User,
      subQuery: true,
      include: Sequelize.Model.$validateIncludedElements({
        limit: 3,
        model: User,
        include: [
          {association: User.Company, required: true, include: [
            Company.Owner
          ]},
          User.Tasks
        ]
      }).include[0].include[0]
    }, {
      default: "LEFT OUTER JOIN [user] AS [Owner] ON [Company.ownerId] = [Owner].[id_user]"
    });

     testsql({
      model: User,
      subQuery: true,
      include: Sequelize.Model.$validateIncludedElements({
        limit: 3,
        model: User,
        include: [
          {association: User.Company, required: true}
        ]
      }).include[0]
    }, {
      default: "INNER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id]"
    });

    /*
     * HasMany
     */

    testsql({
      model: User,
      subQuery: false,
      include: Sequelize.Model.$validateIncludedElements({
        model: User,
        include: [
          User.Tasks
        ]
      }).include[0]
    }, {
      default: "LEFT OUTER JOIN [task] AS [Tasks] ON [User].[id_user] = [Tasks].[user_id]"
    });

    testsql({
      model: User,
      subQuery: true,
      include: Sequelize.Model.$validateIncludedElements({
        limit: 3,
        model: User,
        include: [
          User.Tasks
        ]
      }).include[0]
    }, {
      // The primary key of the main model will be aliased because it's coming from a subquery that the :M join is not a part of
      default: "LEFT OUTER JOIN [task] AS [Tasks] ON [User].[id] = [Tasks].[user_id]"
    });
  });
});