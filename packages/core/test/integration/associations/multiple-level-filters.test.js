'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const dialect = Support.getTestDialect();

describe(Support.getTestDialectTeaser('Multiple Level Filters'), () => {
  it('can filter through belongsTo', async function () {
    const User = this.sequelize.define('User', { username: DataTypes.STRING });
    const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
    const Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      ...(dialect === 'cockroachdb' && { id: 1 }),
      username: 'leia',
    }, {
      ...(dialect === 'cockroachdb' && { id: 2 }),
      username: 'vader',
    }]);

    await Project.bulkCreate([{
      ...(dialect === 'cockroachdb' && { id: 1 }),
      UserId: 1,
      title: 'republic',
    }, {
      ...(dialect === 'cockroachdb' && { id: 2 }),
      UserId: 2,
      title: 'empire',
    }]);

    await Task.bulkCreate([{
      ProjectId: 1,
      title: 'fight empire',
    }, {
      ProjectId: 1,
      title: 'stablish republic',
    }, {
      ProjectId: 2,
      title: 'destroy rebel alliance',
    }, {
      ProjectId: 2,
      title: 'rule everything',
    }]);

    const tasks = await Task.findAll({
      include: [
        {
          model: Project,
          include: [
            { model: User, where: { username: 'leia' } },
          ],
          required: true,
        },
      ],
    });

    expect(tasks.length).to.equal(2);
    expect(tasks[0].title).to.equal('fight empire');
    expect(tasks[1].title).to.equal('stablish republic');
  });

  it('avoids duplicated tables in query', async function () {
    const User = this.sequelize.define('User', { username: DataTypes.STRING });
    const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
    const Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      ...(dialect === 'cockroachdb' && { id: 1 }),
      username: 'leia',
    }, {
      ...(dialect === 'cockroachdb' && { id: 2 }),
      username: 'vader',
    }]);

    await Project.bulkCreate([{
      ...(dialect === 'cockroachdb' && { id: 1 }),
      UserId: 1,
      title: 'republic',
    }, {
      ...(dialect === 'cockroachdb' && { id: 2 }),
      UserId: 2,
      title: 'empire',
    }]);

    await Task.bulkCreate([{
      ...(dialect === 'cockroachdb' && { id: 1 }),
      ProjectId: 1,
      title: 'fight empire',
    }, {
      ...(dialect === 'cockroachdb' && { id: 2 }),
      ProjectId: 1,
      title: 'stablish republic',
    }, {
      ...(dialect === 'cockroachdb' && { id: 3 }),
      ProjectId: 2,
      title: 'destroy rebel alliance',
    }, {
      ...(dialect === 'cockroachdb' && { id: 4 }),
      ProjectId: 2,
      title: 'rule everything',
    }]);

    const tasks = await Task.findAll({
      include: [
        {
          model: Project,
          include: [
            {
              model: User, where: {
                username: 'leia',
                id: 1,
              },
            },
          ],
          required: true,
        },
      ],
    });

    expect(tasks.length).to.equal(2);
    expect(tasks[0].title).to.equal('fight empire');
    expect(tasks[1].title).to.equal('stablish republic');
  });

  it('can filter through hasMany', async function () {
    const User = this.sequelize.define('User', { username: DataTypes.STRING });
    const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
    const Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      ...(dialect === 'cockroachdb' && { id: 1 }),
      username: 'leia',
    }, {
      ...(dialect === 'cockroachdb' && { id: 2 }),
      username: 'vader',
    }]);

    await Project.bulkCreate([{
      ...(dialect === 'cockroachdb' && { id: 1 }),
      UserId: 1,
      title: 'republic',
    }, {
      ...(dialect === 'cockroachdb' && { id: 2 }),
      UserId: 2,
      title: 'empire',
    }]);

    await Task.bulkCreate([{
      ...(dialect === 'cockroachdb' && { id: 1 }),
      ProjectId: 1,
      title: 'fight empire',
    }, {
      ...(dialect === 'cockroachdb' && { id: 2 }),
      ProjectId: 1,
      title: 'stablish republic',
    }, {
      ...(dialect === 'cockroachdb' && { id: 3 }),
      ProjectId: 2,
      title: 'destroy rebel alliance',
    }, {
      ...(dialect === 'cockroachdb' && { id: 4 }),
      ProjectId: 2,
      title: 'rule everything',
    }]);

    const users = await User.findAll({
      include: [
        {
          model: Project,
          include: [
            { model: Task, where: { title: 'fight empire' } },
          ],
          required: true,
        },
      ],
    });

    expect(users.length).to.equal(1);
    expect(users[0].username).to.equal('leia');
  });

  it('can filter through hasMany connector', async function () {
    const User = this.sequelize.define('User', { username: DataTypes.STRING });
    const Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsToMany(User, { through: 'user_project' });
    User.belongsToMany(Project, { through: 'user_project' });

    await this.sequelize.sync({ force: true });

    // CockroachDB uses UUID as the default primary key type instead of integer-based auto-incrementing values
    const userList = dialect === 'cockroachdb' ? [{ id: 1, username: 'leia' }, { id: 2, username: 'vader' }] : [{ username: 'leia' }, { usernmae: 'vader' }];
    await User.bulkCreate(userList);

    const projects = dialect === 'cockroachdb' ? [{ id: 1, title: 'republic' }, { id: 2, title: 'empire' }] : [{ title: 'republic' }, { title: 'empire' }];
    await Project.bulkCreate(projects);

    const user = await User.findByPk(1);
    const project = await Project.findByPk(1);
    await user.setProjects([project]);
    const user0 = await User.findByPk(2);
    const project0 = await Project.findByPk(2);
    await user0.setProjects([project0]);

    const users = await User.findAll({
      include: [
        { model: Project, where: { title: 'republic' } },
      ],
    });

    expect(users.length).to.equal(1);
    expect(users[0].username).to.equal('leia');
  });
});
