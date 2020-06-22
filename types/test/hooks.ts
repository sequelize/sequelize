import { Model, SaveOptions, Sequelize, FindOptions } from "sequelize"
import { ModelHooks } from "../lib/hooks";

/*
 * covers types/lib/sequelize.d.ts
 */

Sequelize.beforeSave((t: TestModel, options: SaveOptions<any>) => {});
Sequelize.afterSave((t: TestModel, options: SaveOptions<any>) => {});
Sequelize.afterFind((t: TestModel[] | TestModel | null, options: FindOptions<any>) => {});
Sequelize.afterFind('namedAfterFind', (t: TestModel[] | TestModel | null, options: FindOptions<any>) => {});

/*
 * covers types/lib/hooks.d.ts
 */

export const sequelize = new Sequelize('uri', {
  hooks: {
    beforeSave (m: Model, options: SaveOptions<any>) {},
    afterSave (m: Model, options: SaveOptions<any>) {},
    afterFind (m: Model[] | Model | null, options: FindOptions<any>) {},
  }
});

class TestModel extends Model {
}

const hooks: Partial<ModelHooks<TestModel, {}>> = {
  beforeSave(t: TestModel, options: SaveOptions<any>) { },
  afterSave(t: TestModel, options: SaveOptions<any>) { },
  afterFind(t: TestModel | TestModel[] | null, options: FindOptions<any>) { },
};

TestModel.init({}, {sequelize, hooks })

TestModel.addHook('beforeSave', (t: TestModel, options: SaveOptions<any>) => { });
TestModel.addHook('afterSave', (t: TestModel, options: SaveOptions<any>) => { });
TestModel.addHook('afterFind', (t: TestModel[] | TestModel | null, options: FindOptions<any>) => { });

/*
 * covers types/lib/model.d.ts
 */

TestModel.beforeSave((t: TestModel, options: SaveOptions<any>) => { });
TestModel.afterSave((t: TestModel, options: SaveOptions<any>) => { });
TestModel.afterFind((t: TestModel | TestModel[] | null, options: FindOptions<any>) => { });
