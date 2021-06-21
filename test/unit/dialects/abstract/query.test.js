'use strict';

const path = require('path');
const Query = require(path.resolve('./lib/dialects/abstract/query.js'));
const Support = require(path.join(__dirname, './../../support'));
const chai = require('chai');
const { stub, match } = require('sinon');
const current = Support.sequelize;
const expect = chai.expect;

describe('[ABSTRACT]', () => {
  describe('_groupJoinData', () => {

    it('should hash second nested set correctly, when has multiple primary keys and one is a Buffer', () => {
      const Team = current.define('team', {
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const Player = current.define('player', {
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const Agent = current.define('agent', {
        uuid: {
          primaryKey: true,
          type: 'BINARY(16)'
        },
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      Team.Player = Team.hasMany(Player, { foreignKey: 'teamId' });
      Team.Agent = Team.hasMany(Agent, { foreignKey: 'teamId' });

      const includeOptions = {
        model: Team,
        includeMap: {
          'players': {
            model: Player,
            association: Team.Player
          },
          'agents': {
            model: Agent,
            association: Team.Agent
          }
        }
      };

      const agentOneUuid = Buffer.from('966ea4c3028c11e7bc99a99d4c0d78cf', 'hex');
      const agentTwoUuid = Buffer.from('966ecbd0028c11e7bc99a99d4c0d78cf', 'hex');

      const data = [
        {
          id: 'a',
          'players.id': '1-1',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-03-06T15:47:30.000Z'),
          'agents.uuid': agentOneUuid,
          'agents.id': 'p',
          'agents.name': 'One'
        },
        {
          id: 'a',
          'players.id': '2-1',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-08-22T11:16:44.000Z'),
          'agents.uuid': agentTwoUuid,
          'agents.id': 'z',
          'agents.name': 'Two'
        }
      ];

      const result = Query._groupJoinData(data, includeOptions, { checkExisting: true });

      expect(result.length).to.be.equal(1);

      expect(result[0]).to.have.property('id').and.be.equal('a');
      expect(result[0].agents).to.be.deep.equal([
        {
          id: 'p',
          uuid: agentOneUuid,
          name: 'One'
        },
        {
          id: 'z',
          uuid: agentTwoUuid,
          name: 'Two'
        }
      ]);
    });

    it('should hash second nested set correctly, when primary is a Buffer', () => {
      const Team = current.define('team', {
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const Player = current.define('player', {
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const Agent = current.define('agent', {
        uuid: {
          primaryKey: true,
          type: 'BINARY(16)'
        }
      });

      Team.Player = Team.hasMany(Player, { foreignKey: 'teamId' });
      Team.Agent = Team.hasMany(Agent, { foreignKey: 'teamId' });

      const includeOptions = {
        model: Team,
        includeMap: {
          'players': {
            model: Player,
            association: Team.Player
          },
          'agents': {
            model: Agent,
            association: Team.Agent
          }
        }
      };

      const agentOneUuid = Buffer.from('966ea4c3028c11e7bc99a99d4c0d78cf', 'hex');
      const agentTwoUuid = Buffer.from('966ecbd0028c11e7bc99a99d4c0d78cf', 'hex');

      const data = [
        {
          id: 'a',
          'players.id': '1-1',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-03-06T15:47:30.000Z'),
          'agents.uuid': agentOneUuid,
          'agents.name': 'One'
        },
        {
          id: 'a',
          'players.id': '2-1',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-08-22T11:16:44.000Z'),
          'agents.uuid': agentTwoUuid,
          'agents.name': 'Two'
        }
      ];

      const result = Query._groupJoinData(data, includeOptions, { checkExisting: true });

      expect(result.length).to.be.equal(1);

      expect(result[0]).to.have.property('id').and.be.equal('a');
      expect(result[0].agents).to.be.deep.equal([
        {
          uuid: agentOneUuid,
          name: 'One'
        },
        {
          uuid: agentTwoUuid,
          name: 'Two'
        }
      ]);
    });

    it('should hash parents correctly, when has multiple primary keys and one is a Buffer', () => {
      const Team = current.define('team', {
        uuid: {
          primaryKey: true,
          type: 'BINARY(16)'
        },
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const Player = current.define('player', {
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const association = Team.hasMany(Player, { foreignKey: 'teamId' });

      const includeOptions = {
        model: Team,
        includeMap: {
          'players': {
            model: Player,
            association
          }
        }
      };

      const teamOneUuid = Buffer.from('966ea4c3028c11e7bc99a99d4c0d78cf', 'hex');
      const teamTwoUuid = Buffer.from('966ecbd0028c11e7bc99a99d4c0d78cf', 'hex');

      const data = [
        {
          uuid: teamOneUuid,
          id: 'x',
          'players.id': '1-1',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-03-06T15:47:30.000Z')
        },
        {
          uuid: teamTwoUuid,
          id: 'y',
          'players.id': '2-1',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-08-22T11:16:44.000Z')
        },
        {
          uuid: teamOneUuid,
          id: 'x',
          'players.id': '1-2',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-08-24T11:16:44.000Z')
        }
      ];

      const result = Query._groupJoinData(data, includeOptions, { checkExisting: true });

      expect(result.length).to.be.equal(2);

      expect(result[0]).to.have.property('uuid').and.be.equal(teamOneUuid);
      expect(result[0].players).to.be.deep.equal([
        {
          'id': '1-1',
          'created': new Date('2017-03-06T15:47:30.000Z'),
          'lastModified': new Date('2017-03-06T15:47:30.000Z')
        },
        {
          'id': '1-2',
          'created': new Date('2017-03-06T15:47:30.000Z'),
          'lastModified': new Date('2017-08-24T11:16:44.000Z')
        }
      ]);

      expect(result[1]).to.have.property('uuid').and.be.equal(teamTwoUuid);
      expect(result[1].players).to.be.deep.equal([{
        'id': '2-1',
        'created': new Date('2017-03-06T15:47:30.000Z'),
        'lastModified': new Date('2017-08-22T11:16:44.000Z')
      }]);
    });

    it('should hash parents correctly, when primary key is a Buffer', () => {
      const Team = current.define('team', {
        uuid: {
          primaryKey: true,
          type: 'BINARY(16)'
        }
      });

      const Player = current.define('player', {
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const association = Team.hasMany(Player, { foreignKey: 'teamId' });

      const includeOptions = {
        model: Team,
        includeMap: {
          'players': {
            model: Player,
            association
          }
        }
      };

      const teamOneUuid = Buffer.from('966ea4c3028c11e7bc99a99d4c0d78cf', 'hex');
      const teamTwoUuid = Buffer.from('966ecbd0028c11e7bc99a99d4c0d78cf', 'hex');

      const data = [
        {
          uuid: teamOneUuid,
          'players.id': '1-1',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-03-06T15:47:30.000Z')
        },
        {
          uuid: teamTwoUuid,
          'players.id': '2-1',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-08-22T11:16:44.000Z')
        },
        {
          uuid: teamOneUuid,
          'players.id': '1-2',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-08-24T11:16:44.000Z')
        }
      ];

      const result = Query._groupJoinData(data, includeOptions, { checkExisting: true });

      expect(result.length).to.be.equal(2);

      expect(result[0]).to.have.property('uuid').and.be.equal(teamOneUuid);
      expect(result[0].players).to.be.deep.equal([
        {
          'id': '1-1',
          'created': new Date('2017-03-06T15:47:30.000Z'),
          'lastModified': new Date('2017-03-06T15:47:30.000Z')
        },
        {
          'id': '1-2',
          'created': new Date('2017-03-06T15:47:30.000Z'),
          'lastModified': new Date('2017-08-24T11:16:44.000Z')
        }
      ]);

      expect(result[1]).to.have.property('uuid').and.be.equal(teamTwoUuid);
      expect(result[1].players).to.be.deep.equal([{
        'id': '2-1',
        'created': new Date('2017-03-06T15:47:30.000Z'),
        'lastModified': new Date('2017-08-22T11:16:44.000Z')
      }]);
    });

    it('should hash nested correctly, when primary key is a Buffer', () => {
      const Team = current.define('team', {
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const Player = current.define('player', {
        uuid: {
          primaryKey: true,
          type: 'BINARY(16)'
        }
      });

      const association = Team.hasMany(Player, { foreignKey: 'teamId' });

      const includeOptions = {
        model: Team,
        includeMap: {
          'players': {
            model: Player,
            association
          }
        }
      };

      const playerOneUuid = Buffer.from('966ea4c3028c11e7bc99a99d4c0d78cf', 'hex');
      const playerTwoUuid = Buffer.from('966ecbd0028c11e7bc99a99d4c0d78cf', 'hex');

      const data = [
        {
          id: '1',
          'players.uuid': playerOneUuid,
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-03-06T15:47:30.000Z')
        },
        {
          id: '1',
          'players.uuid': playerTwoUuid,
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-08-22T11:16:44.000Z')
        }
      ];

      const result = Query._groupJoinData(data, includeOptions, { checkExisting: true });

      expect(result.length).to.be.equal(1);

      expect(result[0]).to.have.property('id').and.be.equal('1');
      expect(result[0].players).to.be.deep.equal([
        {
          'uuid': playerOneUuid,
          'created': new Date('2017-03-06T15:47:30.000Z'),
          'lastModified': new Date('2017-03-06T15:47:30.000Z')
        },
        {
          'uuid': playerTwoUuid,
          'created': new Date('2017-03-06T15:47:30.000Z'),
          'lastModified': new Date('2017-08-22T11:16:44.000Z')
        }
      ]);
    });

    it('should hash nested correctly, when has multiple primary keys and one is a Buffer', () => {
      const Team = current.define('team', {
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const Player = current.define('player', {
        uuid: {
          primaryKey: true,
          type: 'BINARY(16)'
        },
        id: {
          primaryKey: true,
          type: current.Sequelize.STRING(1)
        }
      });

      const association = Team.hasMany(Player, { foreignKey: 'teamId' });

      const includeOptions = {
        model: Team,
        includeMap: {
          'players': {
            model: Player,
            association
          }
        }
      };

      const playerOneUuid = Buffer.from('966ea4c3028c11e7bc99a99d4c0d78cf', 'hex');
      const playerTwoUuid = Buffer.from('966ecbd0028c11e7bc99a99d4c0d78cf', 'hex');

      const data = [
        {
          id: '1',
          'players.uuid': playerOneUuid,
          'players.id': 'x',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-03-06T15:47:30.000Z')
        },
        {
          id: '1',
          'players.uuid': playerTwoUuid,
          'players.id': 'y',
          'players.created': new Date('2017-03-06T15:47:30.000Z'),
          'players.lastModified': new Date('2017-08-22T11:16:44.000Z')
        }
      ];

      const result = Query._groupJoinData(data, includeOptions, { checkExisting: true });

      expect(result.length).to.be.equal(1);

      expect(result[0]).to.have.property('id').and.be.equal('1');
      expect(result[0].players).to.be.deep.equal([
        {
          'uuid': playerOneUuid,
          'id': 'x',
          'created': new Date('2017-03-06T15:47:30.000Z'),
          'lastModified': new Date('2017-03-06T15:47:30.000Z')
        },
        {
          'uuid': playerTwoUuid,
          'id': 'y',
          'created': new Date('2017-03-06T15:47:30.000Z'),
          'lastModified': new Date('2017-08-22T11:16:44.000Z')
        }
      ]);
    });
  });

  describe('_logQuery', () => {
    beforeEach(function() {
      this.cls = class MyQuery extends Query { };
      this.sequelizeStub = {
        log: stub(),
        options: {}
      };
      this.connectionStub = {
        uuid: 'test'
      };
    });

    it('logs before and after', function() {
      const debugStub = stub();
      const qry = new this.cls(this.connectionStub, this.sequelizeStub, {});
      const complete = qry._logQuery('SELECT 1', debugStub);
      complete();
      expect(this.sequelizeStub.log).to.have.been.calledOnce;
      expect(this.sequelizeStub.log).to.have.been.calledWithMatch('Executing (test): SELECT 1');

      expect(debugStub).to.have.been.calledWith('Executing (test): SELECT 1');
      expect(debugStub).to.have.been.calledWith('Executed (test): SELECT 1');
    });

    it('logs before and after with benchmark', function() {
      const debugStub = stub();
      const qry = new this.cls(this.connectionStub, this.sequelizeStub, { benchmark: true });
      const complete = qry._logQuery('SELECT 1', debugStub);
      complete();
      expect(this.sequelizeStub.log).to.have.been.calledOnce;
      expect(this.sequelizeStub.log).to.have.been.calledWithMatch('Executed (test): SELECT 1', match.number, { benchmark: true });

      expect(debugStub).to.have.been.calledWith('Executing (test): SELECT 1');
      expect(debugStub).to.have.been.calledWith('Executed (test): SELECT 1');
    });
  });
});
