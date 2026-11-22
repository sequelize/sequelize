import type { FindOptions, ModelStatic } from '@sequelize/core';
import { DataTypes, Model, Op } from '@sequelize/core';
import { _validateIncludedElements } from '@sequelize/core/_non-semver-use-at-your-own-risk_/model-internals.js';
import at from 'lodash/at';
import type { SqlExpectations } from '../../support';
import { beforeAll2, expectsql, sequelize } from '../../support';

// _conformIncludes and generateJoin are internal methods that are not part of the typings
interface ModelInternals {
  _conformIncludes(options: object, associationOwner: ModelStatic): void;
}

interface QueryGeneratorInternals {
  generateJoin(
    include: unknown,
    topLevelInfo: { options: object; subQuery: unknown },
  ): { join: string; body: string; condition: string };
}

const queryGenerator = sequelize.queryGenerator as typeof sequelize.queryGenerator &
  QueryGeneratorInternals;

describe('QueryGenerator#generateJoin', () => {
  const expectJoin = function (
    path: string,
    findOptions: FindOptions & { model: ModelStatic },
    expectation: SqlExpectations,
  ) {
    (Model as typeof Model & ModelInternals)._conformIncludes(findOptions, findOptions.model);
    const options = _validateIncludedElements(findOptions);

    const include = at(options, path)[0];

    const join = queryGenerator.generateJoin(include, {
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

    const userTasks = User.hasMany(Task, { as: 'Tasks', foreignKey: 'userId', inverse: 'User' });
    const userCompany = User.belongsTo(Company, { as: 'Company', foreignKey: 'companyId' });
    const userProfession = User.belongsTo(Profession, {
      as: 'Profession',
      foreignKey: 'professionId',
    });
    const professionProfessionals = Profession.hasMany(User, {
      as: 'Professionals',
      foreignKey: 'professionId',
      inverse: 'Profession',
    });
    Company.hasMany(User, {
      as: 'Employees',
      foreignKey: 'companyId',
      inverse: 'Company',
    });
    const companyOwner = Company.belongsTo(User, { as: 'Owner', foreignKey: 'ownerId' });

    return {
      User,
      Task,
      Company,
      Profession,
      userCompany,
      companyOwner,
      userProfession,
      userTasks,
      professionProfessionals,
    };
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
        include: [vars.userCompany],
      },
      {
        default: 'LEFT OUTER JOIN [company] AS [Company] ON [User].[company_id] = [Company].[id]',
        oracle: `LEFT OUTER JOIN "company" "Company" ON "User"."company_id" = "Company"."id"`,
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
            association: vars.userCompany,
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
        oracle: `INNER JOIN "company" "Company" ON "User"."company_id" = "Company"."id" OR "Company"."public" = 1`,
      },
    );
  });

  it('Generates a nested belongsTo join query', () => {
    const { Profession } = vars;

    expectJoin(
      'include[0].include[0]',
      {
        model: Profession,
        include: [
          {
            association: vars.professionProfessionals,
            limit: 3,
            include: [vars.userCompany],
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [company] AS [Professionals->Company] ON [Professionals].[company_id] = [Professionals->Company].[id]',
        oracle: `LEFT OUTER JOIN "company" "Professionals->Company" ON "Professionals"."company_id" = "Professionals->Company"."id"`,
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
        include: [vars.userCompany],
      },
      {
        default: 'LEFT OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id]',
        oracle: `LEFT OUTER JOIN "company" "Company" ON "User"."companyId" = "Company"."id"`,
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
            association: vars.userCompany,
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
        oracle: `LEFT OUTER JOIN "company" "Company" ON "User"."companyId" = "Company"."id" AND "Company"."name" = 'ABC'`,
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
            association: vars.userCompany,
            right: true,
          },
        ],
      },
      {
        default: `${sequelize.dialect.supports['RIGHT JOIN'] ? 'RIGHT' : 'LEFT'} OUTER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id]`,
        oracle: `RIGHT OUTER JOIN "company" "Company" ON "User"."companyId" = "Company"."id"`,
      },
    );
  });

  it('supports nested includes with subQuery = true', () => {
    const { User } = vars;

    expectJoin(
      'include[0].include[0]',
      {
        subQuery: true,
        model: User,
        include: [
          {
            association: vars.userCompany,
            include: [vars.companyOwner],
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [user] AS [Company->Owner] ON [Company].[owner_id] = [Company->Owner].[id_user]',
        oracle: `LEFT OUTER JOIN "user" "Company->Owner" ON "Company"."owner_id" = "Company->Owner"."id_user"`,
      },
    );
  });

  it('supports double nested includes', () => {
    const { User } = vars;

    expectJoin(
      'include[0].include[0].include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          {
            association: vars.userCompany,
            include: [
              {
                association: vars.companyOwner,
                include: [vars.userProfession],
              },
            ],
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [profession] AS [Company->Owner->Profession] ON [Company->Owner].[professionId] = [Company->Owner->Profession].[id]',
        oracle: `LEFT OUTER JOIN "profession" "Company->Owner->Profession" ON "Company->Owner"."professionId" = "Company->Owner->Profession"."id"`,
      },
    );
  });

  it('supports nested includes with required = true', () => {
    const { User } = vars;

    expectJoin(
      'include[0].include[0]',
      {
        model: User,
        subQuery: true,
        include: [
          {
            association: vars.userCompany,
            required: true,
            include: [vars.companyOwner],
          },
        ],
      },
      {
        default:
          'LEFT OUTER JOIN [user] AS [Company->Owner] ON [Company].[owner_id] = [Company->Owner].[id_user]',
        oracle: `LEFT OUTER JOIN "user" "Company->Owner" ON "Company"."owner_id" = "Company->Owner"."id_user"`,
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
        include: [{ association: vars.userCompany, required: true }],
      },
      {
        default: 'INNER JOIN [company] AS [Company] ON [User].[companyId] = [Company].[id]',
        oracle: `INNER JOIN "company" "Company" ON "User"."companyId" = "Company"."id"`,
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
        include: [vars.userTasks],
      },
      {
        default: 'LEFT OUTER JOIN [task] AS [Tasks] ON [User].[id_user] = [Tasks].[user_id]',
        oracle: `LEFT OUTER JOIN "task" "Tasks" ON "User"."id_user" = "Tasks"."user_id"`,
      },
    );
  });

  it('supports hasMany with subQuery = true', () => {
    const { User } = vars;

    expectJoin(
      'include[0]',
      {
        model: User,
        subQuery: true,
        include: [vars.userTasks],
      },
      {
        // The primary key of the main model will be aliased because it's coming from a subquery that the :M join is not a part of
        default: 'LEFT OUTER JOIN [task] AS [Tasks] ON [User].[id] = [Tasks].[user_id]',
        oracle: `LEFT OUTER JOIN "task" "Tasks" ON "User"."id" = "Tasks"."user_id"`,
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
            association: vars.userTasks,
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
        oracle: `LEFT OUTER JOIN "task" "Tasks" ON "User"."id_user" = "Tasks"."user_id" OR "Tasks"."user_id" = 2`,
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
            association: vars.userTasks,
            on: { user_id: { [Op.col]: 'User.alternative_id' } },
          },
        ],
      },
      {
        default: 'LEFT OUTER JOIN [task] AS [Tasks] ON [Tasks].[user_id] = [User].[alternative_id]',
        oracle: `LEFT OUTER JOIN "task" "Tasks" ON "Tasks"."user_id" = "User"."alternative_id"`,
      },
    );
  });

  it('supports nested hasMany', () => {
    const { User } = vars;

    expectJoin(
      'include[0].include[0]',
      {
        subQuery: true,
        model: User,
        include: [
          {
            association: vars.userCompany,
            include: [
              {
                association: vars.companyOwner,
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
        oracle: `LEFT OUTER JOIN "user" "Company->Owner" ON "Company"."owner_id" = "Company->Owner"."id_user" OR "Company->Owner"."id_user" = 2`,
      },
    );
  });
});
