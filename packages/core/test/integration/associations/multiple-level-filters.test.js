'use strict';

const chai = require('chai');

const expect = chai.expect;
const Support = require('../support');
const { DataTypes } = require('@sequelize/core');

const current = Support.sequelize;

describe(Support.getTestDialectTeaser('Multiple Level Filters'), () => {
  // TODO: Find a better way for CRDB
  it('can filter through belongsTo', async function () {
    const User = this.sequelize.define('User', { username: DataTypes.STRING });
    const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
    const Project = this.sequelize.define('Project', { title: DataTypes.STRING });
    let user0; let user1; let project0; let project1;

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      username: 'leia',
    }, {
      username: 'vader',
    }]);

    if (current.dialect.name === 'cockroachdb') {
      [user0, user1] = await User.findAll();
    }

    const userId1 = current.dialect.name === 'cockroachdb' ? user0.id : 1;
    const userId2 = current.dialect.name === 'cockroachdb' ? user1.id : 2;

    await Project.bulkCreate([{
      UserId: userId1,
      title: 'republic',
    }, {
      UserId: userId2,
      title: 'empire',
    }]);

    if (current.dialect.name === 'cockroachdb') {
      [project0, project1] = await Project.findAll();
    }

    const projectId1 = current.dialect.name === 'cockroachdb' ? project0.id : 1;
    const projectId2 = current.dialect.name === 'cockroachdb' ? project1.id : 2;

    await Task.bulkCreate([{
      ProjectId: projectId1,
      title: 'fight empire',
    }, {
      ProjectId: projectId1,
      title: 'stablish republic',
    }, {
      ProjectId: projectId2,
      title: 'destroy rebel alliance',
    }, {
      ProjectId: projectId2,
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

    expect(tasks.length).to.be.equal(2);
    expect(tasks[0].title).to.be.equal('fight empire');
    expect(tasks[1].title).to.be.equal('stablish republic');
  });

  // TODO: Find a better way for CRDB
  it('avoids duplicated tables in query', async function () {
    const User = this.sequelize.define('User', { username: DataTypes.STRING });
    const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
    const Project = this.sequelize.define('Project', { title: DataTypes.STRING });
    let user0; let user1; let project0; let project1;

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      username: 'leia',
    }, {
      username: 'vader',
    }]);
    if (current.dialect.name === 'cockroachdb') {
      [user0, user1] = await User.findAll();
    }

    const userId1 = current.dialect.name === 'cockroachdb' ? user0.id : 1;
    const userId2 = current.dialect.name === 'cockroachdb' ? user1.id : 2;

    await Project.bulkCreate([{
      UserId: userId1,
      title: 'republic',
    }, {
      UserId: userId2,
      title: 'empire',
    }]);

    if (current.dialect.name === 'cockroachdb') {
      [project0, project1] = await Project.findAll();
    }

    const projectId1 = current.dialect.name === 'cockroachdb' ? project0.id : 1;
    const projectId2 = current.dialect.name === 'cockroachdb' ? project1.id : 2;

    await Task.bulkCreate([{
      ProjectId: projectId1,
      title: 'fight empire',
    }, {
      ProjectId: projectId1,
      title: 'stablish republic',
    }, {
      ProjectId: projectId2,
      title: 'destroy rebel alliance',
    }, {
      ProjectId: projectId2,
      title: 'rule everything',
    }]);

    const userId3 = current.dialect.name === 'cockroachdb' ? user0.id : 1;
    const tasks = await Task.findAll({
      include: [
        {
          model: Project,
          include: [
            {
              model: User, where: {
                username: 'leia',
                id: userId3,
              },
            },
          ],
          required: true,
        },
      ],
    });

    expect(tasks.length).to.be.equal(2);
    expect(tasks[0].title).to.be.equal('fight empire');
    expect(tasks[1].title).to.be.equal('stablish republic');
  });

  // TODO: Find a better way for CRDB
  it('can filter through hasMany', async function () {
    const User = this.sequelize.define('User', { username: DataTypes.STRING });
    const Task = this.sequelize.define('Task', { title: DataTypes.STRING });
    const Project = this.sequelize.define('Project', { title: DataTypes.STRING });
    let user0; let user1; let project0; let project1;

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      username: 'leia',
    }, {
      username: 'vader',
    }]);

    if (current.dialect.name === 'cockroachdb') {
      [user0, user1] = await User.findAll();
    }

    const userId1 = current.dialect.name === 'cockroachdb' ? user0.id : 1;
    const userId2 = current.dialect.name === 'cockroachdb' ? user1.id : 2;

    await Project.bulkCreate([{
      UserId: userId1,
      title: 'republic',
    }, {
      UserId: userId2,
      title: 'empire',
    }]);

    if (current.dialect.name === 'cockroachdb') {
      [project0, project1] = await Project.findAll();
    }

    const projectId1 = current.dialect.name === 'cockroachdb' ? project0.id : 1;
    const projectId2 = current.dialect.name === 'cockroachdb' ? project1.id : 2;

    await Task.bulkCreate([{
      ProjectId: projectId1,
      title: 'fight empire',
    }, {
      ProjectId: projectId1,
      title: 'stablish republic',
    }, {
      ProjectId: projectId2,
      title: 'destroy rebel alliance',
    }, {
      ProjectId: projectId2,
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

    expect(users.length).to.be.equal(1);
    expect(users[0].username).to.be.equal('leia');
  });

  // TODO: Find a better way for CRDB
  it('can filter through hasMany connector', async function () {
    const User = this.sequelize.define('User', { username: DataTypes.STRING });
    const Project = this.sequelize.define('Project', { title: DataTypes.STRING });
    let user; let user0; let project; let project0;

    Project.belongsToMany(User, { through: 'user_project' });
    User.belongsToMany(Project, { through: 'user_project' });

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      username: 'leia',
    }, {
      username: 'vader',
    }]);

    await Project.bulkCreate([{
      title: 'republic',
    }, {
      title: 'empire',
    }]);

    if (current.dialect.name === 'cockroachdb') {
      [user] = await User.findAll();
      [project] = await Project.findAll();
    } else {
      user = await User.findByPk(1);
      project = await Project.findByPk(1);
    }

    user.setProjects([project]);

    if (current.dialect.name === 'cockroachdb') {
      [, user0] = await User.findAll();
      [, project0] = await Project.findAll();
    } else {
      user0 = await User.findByPk(2);
      project0 = await Project.findByPk(2);
    }

    await user0.setProjects([project0]);

    const users = await User.findAll({
      include: [
        { model: Project, where: { title: 'republic' } },
      ],
    });

    expect(users.length).to.be.equal(1);
    expect(users[0].username).to.be.equal('leia');
  });
});
