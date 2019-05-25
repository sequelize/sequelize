import { Association, HasOne, Model, Sequelize, DataTypes } from 'sequelize';
import { BuildOptions } from '../lib/model';

class MyModel extends Model {
  public num!: number;
  public static associations: {
    other: HasOne;
  };
  public static async customStuff() {
    return this.sequelize!.query('select 1');
  }
}

class OtherModel extends Model {}

const assoc: Association = MyModel.associations.other;

const Instance: MyModel = new MyModel({ int: 10 });
const num: number = Instance.get('num');

MyModel.findOne({
  include: [{ model: OtherModel, paranoid: true }]
});

const sequelize = new Sequelize('mysql://user:user@localhost:3306/mydb');

MyModel.init(
  {},
  {
    indexes: [
      {
        fields: ['foo'],
        using: 'gin',
        operator: 'jsonb_path_ops'
      }
    ],
    sequelize,
    tableName: 'my_model'
  }
);

// Models defined using functions instead of classes
function Functional1Factory(sequelize: Sequelize, dataTypes: typeof DataTypes) {
  const Functional1 = <Functional1Static>sequelize.define('Functional1', {
    id: {
      type: dataTypes.INTEGER,
      primaryKey: true
    },
    foo: {
      type: dataTypes.STRING,
      allowNull: false,
      defaultValue: 'bar'
    }
  });

  Functional1.associate = function(models: ModelDictionary) {
    Functional1.belongsTo(models.Functional2);
  };

  return Functional1;
}

function Functional2Factory(sequelize: Sequelize, dataTypes: typeof DataTypes) {
  const Functional2 = <Functional2Static>sequelize.define('Functional2', {
    id: {
      type: dataTypes.INTEGER,
      primaryKey: true
    },
    foo: {
      type: dataTypes.STRING,
      allowNull: false,
      defaultValue: 'bar'
    }
  });

  Functional2.associate = function(models: ModelDictionary) {
    Functional2.hasMany(models.Functional1);
  };

  return Functional2;
}

const models: ModelDictionary = {
  Functional1: sequelize.import('', Functional1Factory),
  Functional2: sequelize.import('', Functional2Factory)
};

Object.values(models).forEach((model: typeof Model) => {
  model.associate(models);
});

interface Functional1 {
  readonly id: number;
  readonly foo: string;
}

interface Functional2 {
  readonly id: number;
  readonly bar: string;
}

type Functional1Static = typeof Model & {
  new (values?: object, options?: BuildOptions): Functional1;
};

type Functional2Static = typeof Model & {
  new (values?: object, options?: BuildOptions): Functional2;
};

type ModelDictionary = {
  Functional1: Functional1Static;
  Functional2: Functional2Static;
};
