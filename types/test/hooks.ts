import {Model, SaveOptions, Sequelize} from "sequelize"
import { ModelHooks } from "../lib/hooks";

/*
 * covers types/lib/sequelize.d.ts
 */

Sequelize.beforeSave((t: TestModel, options: SaveOptions) => {});
Sequelize.afterSave((t: TestModel, options: SaveOptions) => {});

/*
 * covers types/lib/hooks.d.ts
 */

export const sequelize = new Sequelize('uri', {
  hooks: {
    beforeSave (m: Model, options: SaveOptions) {},
    afterSave (m: Model, options: SaveOptions) {},
  }
});

class TestModel extends Model {
}

const hooks: Partial<ModelHooks> = {
  beforeSave(t: TestModel, options: SaveOptions) { },
  afterSave(t: TestModel, options: SaveOptions) { },
};

TestModel.init({}, {sequelize, hooks })

TestModel.addHook('beforeSave', (t: TestModel, options: SaveOptions) => { });
TestModel.addHook('afterSave', (t: TestModel, options: SaveOptions) => { });

/*
 * covers types/lib/model.d.ts
 */

TestModel.beforeSave((t: TestModel, options: SaveOptions) => { });
TestModel.afterSave((t: TestModel, options: SaveOptions) => { });
