'use strict';

const Support   = require(__dirname + '/../support'),
  DataTypes = require(__dirname + '/../../../lib/data-types'),
  Sequelize = require(__dirname + '/../../../lib/sequelize'),
  util      = require('util'),
  _         = require('lodash'),
  expectsql = Support.expectsql,
  current   = Support.sequelize,
  sql       = current.dialect.QueryGenerator;

// Notice: [] will be replaced by dialect specific tick/quote character when there is not dialect specific expectation but only a default expectation

suite(Support.getTestDialectTeaser('SQL'), () => {
  suite('generateJoin', () => {
    const testsql = function(path, options, expectation) {

      const name = `${path}, ${util.inspect(options, { depth: 10 })}`;

      Sequelize.Model._conformOptions(options);
      options = Sequelize.Model._validateIncludedElements(options);

      const include = _.at(options, path)[0];

      test(name, () => {

        const join = sql.generateJoin(include,
          {
            options,
            subQuery: options.subQuery === undefined ? options.limit && options.hasMultiAssociation : options.subQuery
          }
        );

        return expectsql(`${join.join} ${join.body} ON ${join.condition}`, expectation);
      });
    };

    const User = current.define('User', {
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
    const Task = current.define('Task', {
      title: Sequelize.STRING,
      userId: {
        type: DataTypes.INTEGER,
        field: 'user_id'
      }
    }, {
      tableName: 'task'
    });

    const Company = current.define('Company', {
      name: Sequelize.STRING,
      ownerId: {
        type: Sequelize.INTEGER,
        field: 'owner_id'
      },
      public: {
        type: Sequelize.BOOLEAN
      }
    }, {
      tableName: 'company'
    });

    const Profession = current.define('Profession', {
      name: Sequelize.STRING
    }, {
      tableName: 'profession'
    });

    User.Tasks = User.hasMany(Task, {as: 'Tasks', foreignKey: 'userId'});
    User.Company = User.belongsTo(Company, {foreignKey: 'companyId'});
    User.Profession = User.belongsTo(Profession, {foreignKey: 'professionId'});
    Profession.Professionals = Profession.hasMany(User, {as: 'Professionals', foreignKey: 'professionId'});
    Company.Employees = Company.hasMany(User, {as: 'Employees', foreignKey: 'companyId'});
    Company.Owner = Company.belongsTo(User, {as: 'Owner', foreignKey: 'ownerId'});

    /*
     * BelongsTo
     */

    testsql(
      'include[0]',
      {
        model: User,
        include: [
          User.Company
        ]
      },
      {
        default: 'LEFT OUTER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id]'
      }
    );

    testsql(
      'include[0]',
      {
        model: User,
        include: [
          {
            association: User.Company,
            where: { public: true },
            or: true
          }
        ]
      },
      {
        default: 'INNER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id] OR [Company].[public] = true',
        sqlite: 'INNER JOIN `company` AS `Company` ON `User`.`company_id` = `Company`.`id` OR `Company`.`public` = 1',
        mssql: 'INNER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id] OR [Company].[public] = 1'
      }
    );

    testsql(
      'include[0].include[0]',
      {
        model: Profession,
        include: [
          {
            association: Profession.Professionals,
            limit: 3,
            include: [
              User.Company
            ]
          }
        ]
      },
      {
        default: 'LEFT OUTER JOIN [company] AS [Professionals->Company] ON [Professionals].[company_id] = [Professionals->Company].[id]'
      }
    );

    testsql(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          User.Company
        ]
      },
      {
        default: 'LEFT OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id]'
      }
    );

    testsql(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          {
            association: User.Company, required: false, where: { name: 'ABC' }
          }
        ]
      },
      {
        default: "LEFT OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id] AND [Company].[name] = 'ABC'",
        mssql: "LEFT OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id] AND [Company].[name] = N'ABC'"
      }
    );

    testsql(
      'include[0].include[0]',
      {
        subQuery: true,
        model: User,
        include: [
          {
            association: User.Company, include: [
              Company.Owner
            ]
          }
        ]

      },
      {
        default: 'LEFT OUTER JOIN [user] AS [Company->Owner] ON [Company].[owner_id] = [Company->Owner].[id_user]'
      }
    );

    testsql(
      'include[0].include[0].include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          {
            association: User.Company,
            include: [{
              association: Company.Owner,
              include: [
                User.Profession
              ]
            }]
          }
        ]
      },
      { default: 'LEFT OUTER JOIN [profession] AS [Company->Owner->Profession] ON [Company->Owner].[professionId] = [Company->Owner->Profession].[id]' }
    );

    testsql(
      'include[0].include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          {
            association: User.Company,
            required: true,
            include: [
              Company.Owner
            ]
          }
        ]
      },
      { default: 'LEFT OUTER JOIN [user] AS [Company->Owner] ON [Company].[owner_id] = [Company->Owner].[id_user]' }
    );

    testsql(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          { association: User.Company, required: true }
        ]
      },
      {
        default: 'INNER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id]'
      }
    );

    // /*
    //  * HasMany
    //  */

    testsql(
      'include[0]',
      {
        model: User,
        include: [
          User.Tasks
        ]
      },
      { default: 'LEFT OUTER JOIN [task] AS [Tasks] ON [User].[id_user] = [Tasks].[user_id]' }
    );

    testsql(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          User.Tasks
        ]
      },
      {
        // The primary key of the main model will be aliased because it's coming from a subquery that the :M join is not a part of
        default: 'LEFT OUTER JOIN [task] AS [Tasks] ON [User].[id] = [Tasks].[user_id]'
      }
    );

    testsql(
      'include[0]',
      {
        model: User,
        include: [
          {
            association: User.Tasks, on: {
              $or: [
                { '$User.id_user$': { $col: 'Tasks.user_id' } },
                { '$Tasks.user_id$': 2 }
              ]
            }
          }
        ]
      }, { default: 'LEFT OUTER JOIN [task] AS [Tasks] ON ([User].[id_user] = [Tasks].[user_id] OR [Tasks].[user_id] = 2)' }
    );

    testsql(
      'include[0]',
      {
        model: User,
        include: [
          {
            association: User.Tasks,
            on: { 'user_id': { $col: 'User.alternative_id' } }
          }
        ]
      }, { default: 'LEFT OUTER JOIN [task] AS [Tasks] ON [Tasks].[user_id] = [User].[alternative_id]' }
    );

    testsql(
      'include[0].include[0]',
      {
        subQuery: true,
        model: User,
        include: [
          {
            association: User.Company,
            include: [
              {
                association: Company.Owner,
                on: {
                  $or: [
                    { '$Company.owner_id$': { $col: 'Company.Owner.id_user'} },
                    { '$Company.Owner.id_user$': 2 }
                  ]
                }
              }
            ]
          }
        ]

      },
      {
        default: 'LEFT OUTER JOIN [user] AS [Company->Owner] ON ([Company].[owner_id] = [Company->Owner].[id_user] OR [Company->Owner].[id_user] = 2)'
      }
    );

  });
});
