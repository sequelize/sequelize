'use strict';

/* jshint -W030 */
const chai = require('chai');
const expect = chai.expect;
const Support = require('./../support');
const DataTypes = require('./../../../lib/data-types');

describe(Support.getTestDialectTeaser('Multiple Level Filters'), () => {
  it('can filter through belongsTo', function() {
    const User = this.sequelize.define('User', {username: DataTypes.STRING }), Task = this.sequelize.define('Task', {title: DataTypes.STRING }), Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    return this.sequelize.sync({ force: true }).then(() => User.bulkCreate([{
      username: 'leia'
    }, {
      username: 'vader'
    }]).then(() => Project.bulkCreate([{
      UserId: 1,
      title: 'republic'
    },{
      UserId: 2,
      title: 'empire'
    }]).then(() => Task.bulkCreate([{
      ProjectId: 1,
      title: 'fight empire'
    },{
      ProjectId: 1,
      title: 'stablish republic'
    },{
      ProjectId: 2,
      title: 'destroy rebel alliance'
    },{
      ProjectId: 2,
      title: 'rule everything'
    }]).then(() => Task.findAll({
      include: [
        {model: Project, include: [
          {model: User, where: {username: 'leia'}}
        ]}
      ]
    }).then(tasks => {
      expect(tasks.length).to.be.equal(2);
      expect(tasks[0].title).to.be.equal('fight empire');
      expect(tasks[1].title).to.be.equal('stablish republic');
    })))));
  });

  it('avoids duplicated tables in query', function() {
    const User = this.sequelize.define('User', {username: DataTypes.STRING }), Task = this.sequelize.define('Task', {title: DataTypes.STRING }), Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    return this.sequelize.sync({ force: true }).then(() => User.bulkCreate([{
      username: 'leia'
    }, {
      username: 'vader'
    }]).then(() => Project.bulkCreate([{
      UserId: 1,
      title: 'republic'
    },{
      UserId: 2,
      title: 'empire'
    }]).then(() => Task.bulkCreate([{
      ProjectId: 1,
      title: 'fight empire'
    },{
      ProjectId: 1,
      title: 'stablish republic'
    },{
      ProjectId: 2,
      title: 'destroy rebel alliance'
    },{
      ProjectId: 2,
      title: 'rule everything'
    }]).then(() => Task.findAll({
      include: [
        {model: Project, include: [
          {model: User, where: {
            username: 'leia',
            id: 1
          }}
        ]}
      ]
    }).then(tasks => {
      expect(tasks.length).to.be.equal(2);
      expect(tasks[0].title).to.be.equal('fight empire');
      expect(tasks[1].title).to.be.equal('stablish republic');
    })))));
  });

  it('can filter through hasMany', function() {
    const User = this.sequelize.define('User', {username: DataTypes.STRING }), Task = this.sequelize.define('Task', {title: DataTypes.STRING }), Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsTo(User);
    User.hasMany(Project);

    Task.belongsTo(Project);
    Project.hasMany(Task);

    return this.sequelize.sync({ force: true }).then(() => User.bulkCreate([{
      username: 'leia'
    }, {
      username: 'vader'
    }]).then(() => Project.bulkCreate([{
      UserId: 1,
      title: 'republic'
    },{
      UserId: 2,
      title: 'empire'
    }]).then(() => Task.bulkCreate([{
      ProjectId: 1,
      title: 'fight empire'
    },{
      ProjectId: 1,
      title: 'stablish republic'
    },{
      ProjectId: 2,
      title: 'destroy rebel alliance'
    },{
      ProjectId: 2,
      title: 'rule everything'
    }]).then(() => User.findAll({
      include: [
        {model: Project, include: [
          {model: Task, where: {title: 'fight empire'}}
        ]}
      ]
    }).then(users => {
      expect(users.length).to.be.equal(1);
      expect(users[0].username).to.be.equal('leia');
    })))));
  });

  it('can filter through hasMany connector', function() {
    const User = this.sequelize.define('User', {username: DataTypes.STRING }), Project = this.sequelize.define('Project', { title: DataTypes.STRING });

    Project.belongsToMany(User, {through: 'user_project'});
    User.belongsToMany(Project, {through: 'user_project'});

    return this.sequelize.sync({ force: true }).then(() => User.bulkCreate([{
      username: 'leia'
    }, {
      username: 'vader'
    }]).then(() => Project.bulkCreate([{
      title: 'republic'
    },{
      title: 'empire'
    }]).then(() => User.findById(1).then(user => Project.findById(1).then(project => user.setProjects([project]).then(() => User.findById(2).then(user => Project.findById(2).then(project => user.setProjects([project]).then(() => User.findAll({
      include: [
        {model: Project, where: {title: 'republic'}}
      ]
    }).then(users => {
      expect(users.length).to.be.equal(1);
      expect(users[0].username).to.be.equal('leia');
    }))))))))));
  });
});
