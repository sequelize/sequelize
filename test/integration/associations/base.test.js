'use strict';
const chai = require('chai'), 
  expect = chai.expect, 
  Association = require('../../../lib/associations/base'),
  Support = require('../support'),
  current = Support.sequelize;

describe(Support.getTestDialectTeaser('Base Functions'), () => {
  describe('toInstanceCreate', () => {
    beforeEach(() => {
      this.Product = current.define('Product');
      this.ProductImages = current.define('ProductImages', {
        image: current.Sequelize.STRING,
        thumbnail: current.Sequelize.STRING
      });
      this.association = new Association(this.Product, this.ProductImages);

      this.Product.hasMany(this.ProductImages);

      return current.sync({ force: true });
    });

    it('Should receive a array of models from toInstanceCreate', () => {
      const productImages = [
        { image: 'image1', thunbmail: 'thumbnail1' },
        { image: 'image1', thunbmail: 'thumbnail1' }
      ];

      return this.association.toInstanceCreate(productImages).then(result => {
        expect(result[0].dataValues.image).to.be.equal('image1');
        expect(result).to.be.an('array');
        expect(result).to.have.length(2);
      });
    });

    it('Should just return the model', () => {
      return Promise.resolve(this.ProductImages.create(
        { image: 'image1', thunbmail: 'thumbnail1' }
      )).then(image => {
        return this.association.toInstanceCreate(image).then(result => {
          expect(result[0]).to.be.equal(image);
          expect(result[0]).to.be.an.instanceof(this.ProductImages);
        });
      });
    });

    it('should return a model with a ID', () => {
      const id = 1;
      return this.association.toInstanceCreate(id).then(result => {
        expect(result[0]).to.be.an('object');
        expect(result[0].dataValues.id).to.be.equal(id);
      });
    });
  });
});