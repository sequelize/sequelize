import { Config, Sequelize, Model } from 'sequelize';
import { Fn } from '../lib/utils';

Sequelize.useCLS({
});

export const sequelize = new Sequelize({
  hooks: {
    afterConnect: (connection, config: Config) => {
      // noop
    }
  },
  retry: {
    max: 123,
    match: ['hurr'],
  },
  dialectModule: {},
});

const conn = sequelize.connectionManager;

// hooks

sequelize.beforeCreate('test', () => {
    // noop
});

sequelize
    .addHook('beforeConnect', (config: Config) => {
        // noop
    })
    .addHook('beforeBulkSync', () => {
        // noop
    });

Sequelize.addHook('beforeCreate', () => {
    // noop
}).addHook('beforeBulkCreate', () => {
    // noop
});

Sequelize.beforeConnect(() => {

});

Sequelize.afterConnect(() => {

});

const rnd: Fn = sequelize.random();

const myModel: typeof Model = sequelize.models.asd;
