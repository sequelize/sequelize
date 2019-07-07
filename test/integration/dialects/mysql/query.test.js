'use strict';

const chai = require('chai');
const expect = chai.expect;
const Support = require('../../support');
const dialect = Support.getTestDialect();
const DataTypes = require('../../../../lib/data-types');

if (dialect.match(/^mysql/)) {
  describe('[MYSQL] Query', () => {
    it('should output query log if execute findAll method.', function() {
      const sequelize = Support.createSequelizeInstance(this.sequelize.options);
      const UserModel= {
        name: DataTypes.STRING,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      };
      const User = sequelize.define('User', UserModel, { underscored: true });

      return User.sync({ force: true })
        .then(() => {
          return User.findAll({
            attributes: [
              'id'
            ],
            logging: sql => {
              expect(sql).to.match(/Executing\s+\(default\):\s+SELECT\s+`id`\s+FROM\s+`users`\s+AS\s+`User`;/);
            }
          });
        });
    });
    it('should output query bound parameters log if execute create method.', function() {
      const sequelize = Support.createSequelizeInstance(this.sequelize.options);
      const UserModel= {
        name: DataTypes.STRING,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      };
      const User = sequelize.define('User', UserModel, { underscored: true });

      return User.sync({ force: true })
        .then(() => {
          return User.create({
            name: 'test'
          }, {
            logging: sql => {
              expect(sql).to.match(/Executing\s+\(default\):\s+INSERT\s+INTO\s+`users`\s+\(`id`,`name`,`created_at`,`updated_at`\)\s+VALUES\s+\(DEFAULT,'test','[0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2}:[0-9]{2}','[0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2}:[0-9]{2}'\);/);
            }
          });
        });
    });
    it('should output query bound parameters log if execute update method.', function() {
      const sequelize = Support.createSequelizeInstance(this.sequelize.options);
      const UserModel= {
        name: DataTypes.STRING,
        createdAt: DataTypes.DATE,
        updatedAt: DataTypes.DATE
      };
      const User = sequelize.define('User', UserModel, { underscored: true });

      return User.sync({ force: true })
        .then(() => {
          return User.update({
            name: 'test'
          }, {
            where: {
              id: 1
            },
            logging: sql => {
              expect(sql).to.match(/Executing\s+\(default\):\s+UPDATE\s+`users`\s+SET\s+`name`='test',`updated_at`='[0-9]{4}-[0-9]{2}-[0-9]{2}\s+[0-9]{2}:[0-9]{2}:[0-9]{2}'\s+WHERE\s+`id`\s+=\s+1/);
            }
          });
        });
    });
  });
}
