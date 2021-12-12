'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support = require('../support'),
  DataTypes = require('sequelize/lib/data-types');

describe(Support.getTestDialectTeaser('Multiple Level Filters'), () => {
  it('can filter through belongsTo', async function() {
    const User = this.sequelize.define('User', { username: DataTypes.STRING }),
      Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
      Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      username: 'leia'
    }, {
      username: 'vader'
    }]);

    await Project.bulkCreate([{
      UserId: 1,
      title: 'republic'
    }, {
      UserId: 2,
      title: 'empire'
    }]);

    await Task.bulkCreate([{
      ProjectId: 1,
      title: 'fight empire'
    }, {
      ProjectId: 1,
      title: 'stablish republic'
    }, {
      ProjectId: 2,
      title: 'destroy rebel alliance'
    }, {
      ProjectId: 2,
      title: 'rule everything'
    }]);

    const tasks = await Task.findAll({
      include: [
        {
          model: Project,
          include: [
            { model: User, where: { username: 'leia' } }
          ],
          required: true
        }
      ]
    });

    expect(tasks.length).to.be.equal(2);
    expect(tasks[0].title).to.be.equal('fight empire');
    expect(tasks[1].title).to.be.equal('stablish republic');
  });

  it('avoids duplicated tables in query', async function() {
    const User = this.sequelize.define('User', { username: DataTypes.STRING }),
      Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
      Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      username: 'leia'
    }, {
      username: 'vader'
    }]);

    await Project.bulkCreate([{
      UserId: 1,
      title: 'republic'
    }, {
      UserId: 2,
      title: 'empire'
    }]);

    await Task.bulkCreate([{
      ProjectId: 1,
      title: 'fight empire'
    }, {
      ProjectId: 1,
      title: 'stablish republic'
    }, {
      ProjectId: 2,
      title: 'destroy rebel alliance'
    }, {
      ProjectId: 2,
      title: 'rule everything'
    }]);

    const tasks = await Task.findAll({
      include: [
        {
          model: Project,
          include: [
            { model: User, where: {
              username: 'leia',
              id: 1
            } }
          ],
          required: true
        }
      ]
    });

    expect(tasks.length).to.be.equal(2);
    expect(tasks[0].title).to.be.equal('fight empire');
    expect(tasks[1].title).to.be.equal('stablish republic');
  });

  it('can filter through hasMany', async function() {
    const User = this.sequelize.define('User', { username: DataTypes.STRING }),
      Task = this.sequelize.define('Task', { title: DataTypes.STRING }),
      Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      username: 'leia'
    }, {
      username: 'vader'
    }]);

    await Project.bulkCreate([{
      UserId: 1,
      title: 'republic'
    }, {
      UserId: 2,
      title: 'empire'
    }]);

    await Task.bulkCreate([{
      ProjectId: 1,
      title: 'fight empire'
    }, {
      ProjectId: 1,
      title: 'stablish republic'
    }, {
      ProjectId: 2,
      title: 'destroy rebel alliance'
    }, {
      ProjectId: 2,
      title: 'rule everything'
    }]);

    const users = await User.findAll({
      include: [
        {
          model: Project,
          include: [
            { model: Task, where: { title: 'fight empire' } }
          ],
          required: true
        }
      ]
    });

    expect(users.length).to.be.equal(1);
    expect(users[0].username).to.be.equal('leia');
  });

  it('can filter through hasMany connector', async function() {
    const User = this.sequelize.define('User', { username: DataTypes.STRING }),
      Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsToMany(User, { through: 'user_project' });
    User.belongsToMany(Project, { through: 'user_project' });

    await this.sequelize.sync({ force: true });

    await User.bulkCreate([{
      username: 'leia'
    }, {
      username: 'vader'
    }]);

    await Project.bulkCreate([{
      title: 'republic'
    }, {
      title: 'empire'
    }]);

    const user = await User.findByPk(1);
    const project = await Project.findByPk(1);
    await user.setProjects([project]);
    const user0 = await User.findByPk(2);
    const project0 = await Project.findByPk(2);
    await user0.setProjects([project0]);

    const users = await User.findAll({
      include: [
        { model: Project, where: { title: 'republic' } }
      ]
    });

    expect(users.length).to.be.equal(1);
    expect(users[0].username).to.be.equal('leia');
  });
});
