import { expect } from 'chai';
import type { InferAttributes, NonAttribute, CreationOptional, InferCreationAttributes } from '@sequelize/core';
import { DataTypes, Op, Model, attribute } from '@sequelize/core';
import { Attribute, BelongsTo } from '@sequelize/core/decorators-legacy';
import {
  beforeAll2,
  beforeEach2,
  disableDatabaseResetForSuite,
  enableTruncateDatabaseForSuite,
  inlineErrorCause,
  sequelize,
} from './support';

const dialect = sequelize.dialect;
const dialectName = dialect.name;

/**
 * Whether the current dialect supports comparing JSON to JSON directly.
 * In dialects like postgres, no "json = json" operator exists, we need to cast to text first.
 * It does however support "jsonb = jsonb".
 */
const dialectSupportsJsonEquality = ['sqlite', 'mysql', 'mariadb'].includes(dialectName);

describe('JSON Manipulation', () => {
  if (!dialect.supports.dataTypes.JSON) {
    return;
  }

  const vars = beforeEach2(async () => {
    class User extends Model<InferAttributes<User>> {
      @Attribute(DataTypes.JSON)
      declare jsonAttr: any;
    }

    sequelize.addModels([User]);
    await sequelize.sync({ force: true });

    return { User };
  });

  it('supports inserting json', async () => {
    const user = await vars.User.create({
      jsonAttr: { username: 'joe' },
    });

    expect(user.jsonAttr).to.deep.equal({ username: 'joe' });
  });

  it('supports updating json', async () => {
    const user = await vars.User.create({
      jsonAttr: { username: 'joe' },
    });

    user.jsonAttr = { name: 'larry' };

    await user.save();

    expect(user.jsonAttr).to.deep.equal({ name: 'larry' });
  });

  it('should be able to store strings that require escaping', async () => {
    const text = 'Multi-line \n \'$string\' needing "escaping" for $$ and $1 type values';

    await vars.User.create({ jsonAttr: text });
    const user = await vars.User.findOne({ rejectOnEmpty: true });
    expect(user.jsonAttr).to.equal(text);
  });
});

const JSON_OBJECT = { name: 'swen', phones: [1337, 42] };
const JSON_STRING = 'kate';

describe('JSON Querying', () => {
  if (!dialect.supports.dataTypes.JSON) {
    return;
  }

  disableDatabaseResetForSuite();

  const vars = beforeAll2(async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare id: CreationOptional<number>;

      @Attribute(DataTypes.JSON)
      declare objectJsonAttr: object;

      @Attribute(DataTypes.JSON)
      declare stringJsonAttr: string;
    }

    class Order extends Model<InferAttributes<Order>> {
      @BelongsTo(User, 'userId')
      declare user: NonAttribute<User>;

      @Attribute(DataTypes.INTEGER)
      declare userId: number;
    }

    sequelize.addModels([User, Order]);
    await sequelize.sync({ force: true });

    const user = await User.create({
      objectJsonAttr: JSON_OBJECT,
      stringJsonAttr: JSON_STRING,
    });

    await Order.create({ userId: user.id });

    return { User, Order };
  });

  it('parses retrieved JSON values', async () => {
    const user = await vars.User.findOne({ rejectOnEmpty: true });

    expect(user.objectJsonAttr).to.deep.eq(JSON_OBJECT);
    expect(user.stringJsonAttr).to.eq(JSON_STRING);
  });

  if (dialectSupportsJsonEquality) {
    it('should be able to compare JSON to JSON directly', async () => {
      const user = await vars.User.findOne({
        where: {
          stringJsonAttr: JSON_STRING,
        },
      });

      expect(user).to.exist;
    });
  } else {
    it('should not be able to compare JSON to JSON directly', async () => {
      await expect(vars.User.findOne({
        where: {
          stringJsonAttr: JSON_STRING,
        },
      })).to.be.rejected;
    });
  }

  if (dialect.supports.jsonOperations) {
    it('should be able to retrieve element of array by index', async () => {
      const user = await vars.User.findOne({
        attributes: [[attribute('objectJsonAttr.phones[1]'), 'firstEmergencyNumber']],
        rejectOnEmpty: true,
      });

      // @ts-expect-error -- typings are not currently designed to handle custom attributes
      const firstNumber: string = user.getDataValue('firstEmergencyNumber');

      expect(Number.parseInt(firstNumber, 10)).to.equal(42);
    });

    it('should be able to query using JSON path objects', async () => {
      const user = await vars.User.findOne({
        // JSON requires casting to text in postgres. There is no "json = json" operator
        // No-cast version is tested higher up in this suite
        where: { objectJsonAttr: { 'name::text': '"swen"' } },
      });

      expect(user).to.exist;
    });

    it('should be able to query using JSON path dot notation', async () => {
      const user = await vars.User.findOne({
        // JSON requires casting to text in postgres. There is no "json = json" operator
        // No-cast version is tested higher up in this suite
        where: { 'objectJsonAttr.name::text': '"swen"' },
      });

      expect(user).to.exist;
    });

    it('should be able to query using the JSON unquote syntax', async () => {
      const user = await vars.User.findOne({
        // JSON unquote does not require casting to text, as it already returns text
        where: { 'objectJsonAttr->>name': 'swen' },
      });

      expect(user).to.exist;
    });

    it('should be able retrieve json value with nested include', async () => {
      const orders = await vars.Order.findAll({
        attributes: ['id'],
        include: [{
          model: vars.User,
          attributes: [
            [attribute('objectJsonAttr.name'), 'name'],
          ],
        }],
      });

      // @ts-expect-error -- getDataValue does not support custom attributes
      expect(orders[0].user.getDataValue('name')).to.equal('swen');
    });
  }
});

describe('JSON Casting', () => {
  if (!dialect.supports.dataTypes.JSON) {
    return;
  }

  enableTruncateDatabaseForSuite();

  const vars = beforeAll2(async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      @Attribute(DataTypes.JSON)
      declare jsonAttr: any;
    }

    sequelize.addModels([User]);
    await sequelize.sync({ force: true });

    return { User };
  });

  it('supports casting to timestamp types', async () => {
    await vars.User.create({
      jsonAttr: {
        date: new Date('2021-01-02').toISOString(),
      },
    });

    const user = await vars.User.findOne({
      where: {
        'jsonAttr->>date::timestamptz': new Date('2021-01-02'),
      },
    });

    expect(user).to.exist;

    const user2 = await vars.User.findOne({
      where: {
        'jsonAttr->>date::timestamptz': {
          [Op.between]: [new Date('2021-01-01'), new Date('2021-01-03')],
        },
      },
    });

    expect(user2).to.exist;
  });

  it('supports casting to boolean', async () => {
    await vars.User.create({
      jsonAttr: {
        boolean: true,
      },
    });

    const user = await vars.User.findOne({
      where: {
        'jsonAttr->>boolean::boolean': true,
      },
    });

    expect(user).to.exist;
  });

  it('supports casting to numbers', async () => {
    await vars.User.create({
      jsonAttr: {
        integer: 7,
      },
    });

    const user = await vars.User.findOne({
      where: {
        'jsonAttr->>integer::integer': 7,
      },
    });

    expect(user).to.exist;
  });
});

describe('JSONB Querying', () => {
  if (!dialect.supports.dataTypes.JSONB) {
    return;
  }

  disableDatabaseResetForSuite();

  const vars = beforeAll2(async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      declare id: CreationOptional<number>;

      @Attribute(DataTypes.JSONB)
      declare objectJsonbAttr: object;

      @Attribute(DataTypes.JSONB)
      declare stringJsonbAttr: CreationOptional<string>;
    }

    class Order extends Model<InferAttributes<Order>> {
      @BelongsTo(User, 'userId')
      declare user: NonAttribute<User>;

      @Attribute(DataTypes.INTEGER)
      declare userId: number;
    }

    sequelize.addModels([User, Order]);
    await sequelize.sync({ force: true });

    const user = await User.create({
      objectJsonbAttr: JSON_OBJECT,
      stringJsonbAttr: JSON_STRING,
    });

    await Order.create({ userId: user.id });

    return { User, Order };
  });

  it('should be able to query using the nested query language', async () => {
    const user = await vars.User.findOne({
      // JSONB does not require casting
      where: { objectJsonbAttr: { name: 'swen' } },
    });

    expect(user).to.exist;
  });

  it('should be able to query using the JSON unquote syntax', async () => {
    const user = await vars.User.findOne({
      where: { 'objectJsonbAttr->>name': 'swen' },
    });

    expect(user).to.exist;
  });

  it('should be able to query using dot syntax', async () => {
    const user = await vars.User.findOne({
      // JSONB does not require casting, nor unquoting
      where: { 'objectJsonbAttr.name': 'swen' },
    });

    expect(user).to.exist;
  });

  it('should be able retrieve json value with nested include', async () => {
    const orders = await vars.Order.findAll({
      attributes: ['id'],
      include: [{
        model: vars.User,
        attributes: [
          [attribute('objectJsonbAttr.name'), 'name'],
        ],
      }],
    });

    // @ts-expect-error -- getDataValue's typing does not support custom attributes
    expect(orders[0].user.getDataValue('name')).to.equal('swen');
  });

  it('should be able to check any of these array strings exist as top-level keys', async () => {
    const user = await vars.User.findOne({
      where: {
        objectJsonbAttr: {
          [Op.anyKeyExists]: ['name', 'does-not-exist'],
        },
      },
    });

    expect(user).to.exist;
  });

  it('should be able to check all of these array strings exist as top-level keys', async () => {
    const user = await vars.User.findOne({
      where: {
        objectJsonbAttr: {
          [Op.allKeysExist]: ['name', 'phones'],
        },
      },
    });

    expect(user).to.exist;
  });

  it('should be able to findOrCreate with values that require escaping', async () => {
    const text = 'Multi-line \'$string\' needing "escaping" for $$ and $1 type values';

    const [user, created] = await vars.User.findOrCreate({
      where: { objectJsonbAttr: { text } },
      defaults: { objectJsonbAttr: { text } },
    });

    expect(created).to.equal(true);
    expect(user.isNewRecord).to.equal(false);

    const refreshedUser = await vars.User.findOne({ where: { 'objectJsonbAttr->>text': text } });
    expect(refreshedUser).to.exist;
  });
});

describe('JSONB Casting', () => {
  if (!dialect.supports.dataTypes.JSON) {
    return;
  }

  enableTruncateDatabaseForSuite();

  const vars = beforeAll2(async () => {
    class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
      @Attribute(DataTypes.JSONB)
      declare jsonbAttr: any;
    }

    sequelize.addModels([User]);
    await sequelize.sync({ force: true });

    return { User };
  });

  it('supports comparing to json null', async () => {
    await vars.User.create({
      jsonbAttr: {
        // This is JSON null
        value: null,
      },
    });

    const user = await vars.User.findOne({
      where: {
        // Using the 'EQ' operator compares to SQL NULL
        'jsonbAttr.value': { [Op.eq]: null },
      },
    });

    expect(user).to.exist;
  });

  it('supports comparing to SQL NULL', async () => {
    await vars.User.create({
      jsonbAttr: {},
    });

    const user = await vars.User.findOne({
      where: {
        // Using the 'IS' operator compares to SQL NULL
        'jsonbAttr.value': { [Op.is]: null },
      },
    });

    expect(user).to.exist;
  });

  it('requires being explicit when comparing to NULL', async () => {
    const error = await expect(vars.User.findOne({
      where: {
        'jsonbAttr.value': null,
      },
    })).to.be.rejected;

    expect(inlineErrorCause(error)).to.include('Because JSON has two possible null values, comparing a JSON/JSONB attribute to NULL requires an explicit comparison operator. Use the `Op.is` operator to compare to SQL NULL, or the `Op.eq` operator to compare to JSON null.');
  });
});
