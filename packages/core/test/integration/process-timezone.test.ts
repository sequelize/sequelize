import type { Sequelize } from '@sequelize/core';
import { DataTypes } from '@sequelize/core';
import { expect } from 'chai';
import { useProcessTimezone } from '../support';
import { beforeAll2, createSequelizeInstance, sequelize as defaultSequelize } from './support';

const dates = [new Date('2012-01-10T09:10:10Z'), new Date('2012-07-10T09:10:10Z')];

for (const timezone of ['Europe/Amsterdam', 'America/New_York', 'Asia/Kolkata']) {
  describe(`process timezone ${timezone}`, () => {
    useProcessTimezone(timezone);

    const vars = beforeAll2(() => ({ sequelize: createSequelizeInstance() }));

    after(async () => {
      await vars.sequelize.close();
    });

    function defineUser(sequelize: Sequelize) {
      return sequelize.define('User', { date: DataTypes.DATE });
    }

    it('stores timestamps set with silent: true', async () => {
      const User = defineUser(vars.sequelize);
      await vars.sequelize.sync({ force: true });

      const users = await Promise.all(
        dates.map(async date =>
          User.create({ createdAt: date, updatedAt: date }, { silent: true }),
        ),
      );
      await Promise.all(users.map(async user => user.reload()));

      expect(users.map(user => user.get('createdAt'))).to.deep.equal(dates);
      expect(users.map(user => user.get('updatedAt'))).to.deep.equal(dates);
    });

    it('stores dates with create, update and bulkCreate', async () => {
      const User = defineUser(vars.sequelize);
      await vars.sequelize.sync({ force: true });

      await User.create({ date: dates[0] });
      await User.create({ date: dates[1] });
      const updated = await User.create({});
      await updated.update({ date: dates[1] });
      await User.bulkCreate(dates.map(date => ({ date })));

      const users = await User.findAll({ order: [['id', 'ASC']] });
      expect(users.map(user => user.get('date'))).to.deep.equal([...dates, dates[1], ...dates]);

      const counts = await Promise.all(dates.map(async date => User.count({ where: { date } })));
      expect(counts).to.deep.equal([2, 3]);
    });

    if (defaultSequelize.dialect.supports.upserts) {
      it('does not overwrite createdAt supplied to upsert', async () => {
        const User = vars.sequelize.define('User', { name: DataTypes.STRING });
        await vars.sequelize.sync({ force: true });

        await User.upsert(
          { id: 1, name: 'january', createdAt: dates[0] },
          { fields: ['id', 'name'] },
        );
        await User.upsert({ id: 2, name: 'july', createdAt: dates[1] }, { fields: ['id', 'name'] });

        const users = await User.findAll({ order: [['id', 'ASC']] });
        expect(users.map(user => user.get('createdAt'))).to.deep.equal(dates);
      });
    }

    it('keeps an explicit deletedAt of paranoid models', async () => {
      const User = vars.sequelize.define('User', {}, { paranoid: true });
      await vars.sequelize.sync({ force: true });

      await Promise.all(dates.map(async deletedAt => User.create({ deletedAt })));

      expect(await User.count()).to.equal(0);
      const counts = await Promise.all(
        dates.map(async deletedAt => User.count({ where: { deletedAt }, paranoid: false })),
      );
      expect(counts).to.deep.equal([1, 1]);
    });

    it('reads dates of included models', async () => {
      const User = defineUser(vars.sequelize);
      const Task = vars.sequelize.define('Task', { date: DataTypes.DATE }, { timestamps: false });
      User.hasMany(Task);
      await vars.sequelize.sync({ force: true });

      const user = await User.create(
        { date: dates[0], tasks: dates.map(date => ({ date })) },
        { include: [Task] },
      );

      const users = await User.findAll({
        where: { id: user.get('id') },
        include: [Task],
        order: [[Task, 'date', 'ASC']],
      });

      expect(users[0].get('date')).to.deep.equal(dates[0]);
      expect((users[0].get('tasks') as any[]).map(task => task.get('date'))).to.deep.equal(dates);
    });
  });
}
