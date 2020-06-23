import {Model, SaveOptions, Sequelize, FindOptions} from "sequelize"
import { ModelHooks } from "../lib/hooks";

/*
 * covers types/lib/sequelize.d.ts
 */

Sequelize.beforeSave((t: TestModel, options: SaveOptions) => {});
Sequelize.afterSave((t: TestModel, options: SaveOptions) => {});
Sequelize.afterFind((t: TestModel[] | TestModel | null, options: FindOptions) => {});
Sequelize.afterFind('namedAfterFind', (t: TestModel[] | TestModel | null, options: FindOptions) => {});

/*
 * covers types/lib/hooks.d.ts
 */

export const sequelize = new Sequelize('uri', {
  hooks: {
    beforeSave (m: Model, options: SaveOptions) {},
    afterSave (m: Model, options: SaveOptions) {},
    afterFind (m: Model[] | Model | null, options: FindOptions) {},
  }
});

class TestModel extends Model {
}

const hooks: Partial<ModelHooks> = {
  beforeSave(t: TestModel, options: SaveOptions) { },
  afterSave(t: TestModel, options: SaveOptions) { },
  afterFind(t: TestModel | TestModel[] | null, options: FindOptions) { },
};

TestModel.init({}, {sequelize, hooks })

TestModel.addHook('beforeSave', (t: TestModel, options: SaveOptions) => { });
TestModel.addHook('afterSave', (t: TestModel, options: SaveOptions) => { });
TestModel.addHook('afterFind', (t: TestModel[] | TestModel | null, options: FindOptions) => { });

/*
 * covers types/lib/model.d.ts
 */

TestModel.beforeSave((t: TestModel, options: SaveOptions) => { });
TestModel.afterSave((t: TestModel, options: SaveOptions) => { });
TestModel.afterFind((t: TestModel | TestModel[] | null, options: FindOptions) => { });
