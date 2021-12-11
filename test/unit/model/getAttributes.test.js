'use strict';

const chai = require('chai'),
  expect = chai.expect,
  Support   = require('../support'),
  current   = Support.sequelize,
  _ = require('lodash'),
  DataTypes = require('sequelize/lib/data-types');

  describe(Support.getTestDialectTeaser('Model'), () => {
    describe('getAttributes', () => {
      it('should return attributes with getAttributes()', () => {
        const Model = current.define('User', {}, {
          createdAt: 'createdAt',
          updatedAt: 'updatedAt',
          timestamps: true
        });  
        expect(Model.getAttributes()).to.haveOwnProperty('createdAt');
        expect(Model.getAttributes()).to.haveOwnProperty('updatedAt');
      }); 
    });
  });
  