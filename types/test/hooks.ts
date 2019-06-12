import {Model, SaveOptions, Sequelize, FindOptions} from "sequelize"
import { ModelHooks } from "../lib/hooks";

/*
 * covers types/lib/sequelize.d.ts
 */

Sequelize.hooks.add('beforeSave', (t: TestModel, options: SaveOptions) => {});
Sequelize.hooks.add('afterSave', (t: TestModel, options: SaveOptions) => {});
Sequelize.hooks.add('afterFind', (t: TestModel[] | TestModel | null, options: FindOptions) => {});
Sequelize.hooks.add('afterFind', (t: TestModel[] | TestModel | null, options: FindOptions) => {});

Sequelize.hooks.add('beforeSave', m => {

});
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

TestModel.hooks.add('beforeSave', (t: TestModel, options: SaveOptions) => { });
TestModel.hooks.add('afterSave', (t: TestModel, options: SaveOptions) => { });
TestModel.hooks.add('afterFind', (t: TestModel[] | TestModel | null, options: FindOptions) => { });

