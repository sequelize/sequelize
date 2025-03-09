'use strict';

const at = require('lodash/at');

const { beforeAll2, expectsql, sequelize } = require('../../support');
const { DataTypes, Model, Op } = require('@sequelize/core');
const {
  _validateIncludedElements,
} = require('@sequelize/core/_non-semver-use-at-your-own-risk_/model-internals.js');

const sql = sequelize.queryGenerator;

describe('QueryGenerator#generateJoin', () => {
  const expectJoin = function (path, options, expectation) {
    Model._conformIncludes(options, options.model);
    options = _validateIncludedElements(options);

    const include = at(options, path)[0];

    const join = sql.generateJoin(include, {
      options,
      subQuery:
        options.subQuery === undefined
          ? options.limit && options.hasMultiAssociation
          : options.subQuery,
    });

    return expectsql(`${join.join} ${join.body} ON ${join.condition}`, expectation);
  };

  const vars = beforeAll2(() => {
    const User = sequelize.define(
      'User',
      {
        id: {
          type: DataTypes.INTEGER,
          primaryKey: true,
          autoIncrement: true,
          field: 'id_user',
        },
        companyId: {
          type: DataTypes.INTEGER,
          field: 'company_id',
        },
      },
      {
        tableName: 'user',
      },
    );

    const Task = sequelize.define(
      'Task',
      {
        title: DataTypes.STRING,
        userId: {
          type: DataTypes.INTEGER,
          field: 'user_id',
        },
      },
      {
        tableName: 'task',
      },
    );

    const Company = sequelize.define(
      'Company',
      {
        name: DataTypes.STRING,
        ownerId: {
          type: DataTypes.INTEGER,
          field: 'owner_id',
        },
        public: {
          type: DataTypes.BOOLEAN,
        },
      },
      {
        tableName: 'company',
      },
    );

    const Profession = sequelize.define(
      'Profession',
      {
        name: DataTypes.STRING,
      },
      {
        tableName: 'profession',
      },
    );

    User.Tasks = User.hasMany(Task, { as: 'Tasks', foreignKey: 'userId', inverse: 'User' });
    User.Company = User.belongsTo(Company, { as: 'Company', foreignKey: 'companyId' });
    User.Profession = User.belongsTo(Profession, { as: 'Profession', foreignKey: 'professionId' });
    Profession.Professionals = Profession.hasMany(User, {
      as: 'Professionals',
      foreignKey: 'professionId',
      inverse: 'Profession',
    });
    Company.Employees = Company.hasMany(User, {
      as: 'Employees',
      foreignKey: 'companyId',
      inverse: 'Company',
    });
    Company.Owner = Company.belongsTo(User, { as: 'Owner', foreignKey: 'ownerId' });

    return { User, Task, Company, Profession };
  });

  /*
   * BelongsTo
   */

  it('Generates a join query for a belongsTo association', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        include: [User.Company],
      },
      {
        default: 'LEFT OUTER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id]',
      },
    );
  });

  it('Generates a belongsTo join query with an extra OR "on" condition', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        include: [
          {
            association: User.Company,
            where: { public: true },
            or: true,
          },
        ],
      },
      {
        default:
          'INNER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id] OR [Company].[public] = true',
        ibmi: 'INNER JOIN "company" AS "Company" ON "User"."company_id" = "Company"."id" OR "Company"."public" = 1',
        sqlite3:
          'INNER JOIN `company` AS `Company` ON `User`.`company_id` = `Company`.`id` OR `Company`.`public` = 1',
        mssql:
          'INNER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id] OR [Company].[public] = 1',
      },
    );
  });

  it('Generates a nested belongsTo join query', () => {
    const { Profession, User } = vars;

    expectJoin(
      'include[0].include[0]',
      {
        model: Profession,
        include: [
          {
            association: Profession.Professionals,
            limit: 3,
            include: [User.Company],
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [company] AS [Professionals->Company] ON [Professionals].[company_id] = [Professionals->Company].[id]',
      },
    );
  });

  it('supports subQuery = true', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [User.Company],
      },
      {
        default: 'LEFT OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id]',
      },
    );
  });

  it('supports subQuery = true with required = false and nested WHERE', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          {
            association: User.Company,
            required: false,
            where: { name: 'ABC' },
          },
        ],
      },
      {
        default:
          "LEFT OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id] AND [Company].[name] = 'ABC'",
        mssql:
          "LEFT OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id] AND [Company].[name] = N'ABC'",
      },
    );
  });

  it('supports "right = true"', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          {
            association: User.Company,
            right: true,
          },
        ],
      },
      {
        default: `${sequelize.dialect.supports['RIGHT JOIN'] ? 'RIGHT' : 'LEFT'} OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id]`,
      },
    );
  });

  it('supports nested includes with subQuery = true', () => {
    const { Company, User } = vars;

    expectJoin(
      'include[0].include[0]',
      {
        subQuery: true,
        model: User,
        include: [
          {
            association: User.Company,
            include: [Company.Owner],
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [user] AS [Company->Owner] ON [Company].[owner_id] = [Company->Owner].[id_user]',
      },
    );
  });

  it('supports double nested includes', () => {
    const { Company, User } = vars;

    expectJoin(
      'include[0].include[0].include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          {
            association: User.Company,
            include: [
              {
                association: Company.Owner,
                include: [User.Profession],
              },
            ],
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [profession] AS [Company->Owner->Profession] ON [Company->Owner].[professionId] = [Company->Owner->Profession].[id]',
      },
    );
  });

  it('supports nested includes with required = true', () => {
    const { Company, User } = vars;

    expectJoin(
      'include[0].include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          {
            association: User.Company,
            required: true,
            include: [Company.Owner],
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [user] AS [Company->Owner] ON [Company].[owner_id] = [Company->Owner].[id_user]',
      },
    );
  });

  it('supports required = true', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [{ association: User.Company, required: true }],
      },
      {
        default: 'INNER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id]',
      },
    );
  });

  // /*
  //  * HasMany
  //  */

  it('supports hasMany', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        include: [User.Tasks],
      },
      { default: 'LEFT OUTER JOIN [task] AS [Tasks] ON [User].[id_user] = [Tasks].[user_id]' },
    );
  });

  it('supports hasMany with subQuery = true', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [User.Tasks],
      },
      {
        // The primary key of the main model will be aliased because it's coming from a subquery that the :M join is not a part of
        default: 'LEFT OUTER JOIN [task] AS [Tasks] ON [User].[id] = [Tasks].[user_id]',
      },
    );
  });

  it('supports hasMany with "on" condition', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        include: [
          {
            association: User.Tasks,
            on: {
              [Op.or]: [
                { '$User.id_user$': { [Op.col]: 'Tasks.user_id' } },
                { '$Tasks.user_id$': 2 },
              ],
            },
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [task] AS [Tasks] ON [User].[id_user] = [Tasks].[user_id] OR [Tasks].[user_id] = 2',
      },
    );
  });

  it('supports hasMany with "on" condition (2)', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        include: [
          {
            association: User.Tasks,
            on: { user_id: { [Op.col]: 'User.alternative_id' } },
          },
        ],
      },
      {
        default: 'LEFT OUTER JOIN [task] AS [Tasks] ON [Tasks].[user_id] = [User].[alternative_id]',
      },
    );
  });

  it('supports nested hasMany', () => {
    const { Company, User } = vars;

    expectJoin(
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
                  [Op.or]: [
                    { '$Company.owner_id$': { [Op.col]: 'Company.Owner.id_user' } },
                    { '$Company.Owner.id_user$': 2 },
                  ],
                },
              },
            ],
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [user] AS [Company->Owner] ON [Company].[owner_id] = [Company->Owner].[id_user] OR [Company->Owner].[id_user] = 2',
      },
    );
  });
});
