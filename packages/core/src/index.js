'use strict';

/**
 * A Sequelize module that contains the sequelize entry point.
 *
 * @module sequelize
 */

const { and, or, Sequelize } = require('./sequelize');
const { AbstractConnectionManager } = require('./abstract-dialect/connection-manager');
const { AbstractDialect } = require('./abstract-dialect/dialect');
const { AbstractQueryGenerator } = require('./abstract-dialect/query-generator');
const { AbstractQueryInterface } = require('./abstract-dialect/query-interface');
const { AbstractQuery } = require('./abstract-dialect/query');
const { Association } = require('./associations/base');
const { BelongsToAssociation } = require('./associations/belongs-to');
const { BelongsToManyAssociation } = require('./associations/belongs-to-many');
const { HasManyAssociation } = require('./associations/has-many');
const { HasOneAssociation } = require('./associations/has-one');
const DataTypes = require('./data-types');
const { ConstraintChecking, Deferrable } = require('./deferrable');
const { IndexHints, ParameterStyle, QueryTypes, TableHints } = require('./enums');
const SequelizeErrors = require('./errors');
const { AssociationPath } = require('./expression-builders/association-path');
const { Attribute } = require('./expression-builders/attribute');
const { Cast, cast } = require('./expression-builders/cast');
const { Col, col } = require('./expression-builders/col');
const { Fn, fn } = require('./expression-builders/fn');
const { Identifier } = require('./expression-builders/identifier');
const { JsonPath } = require('./expression-builders/json-path');
const { JSON_NULL, SQL_NULL } = require('./expression-builders/json-sql-null');
const { json } = require('./expression-builders/json');
const { List } = require('./expression-builders/list');
const { Literal, literal } = require('./expression-builders/literal');
const { sql } = require('./expression-builders/sql');
const { Value } = require('./expression-builders/value');
const { Where, where } = require('./expression-builders/where');
const { GeoJsonType } = require('./geo-json');
const { importModels } = require('./import-models');
const { Model } = require('./model');
const { ManualOnDelete } = require('./model-repository.types');
const { Op } = require('./operators');
const {
  IsolationLevel,
  Lock,
  Transaction,
  TransactionNestMode,
  TransactionType,
} = require('./transaction');
const { isModelStatic, isSameInitialModel } = require('./utils/model-utils');
const { useInflection } = require('./utils/string');
const { Validator } = require('./utils/validator-extras');
const { ValidationErrorItemOrigin, ValidationErrorItemType } = require('./errors/validation-error');

module.exports.Sequelize = Sequelize;
module.exports.fn = fn;
module.exports.Fn = Fn;
module.exports.col = col;
module.exports.Col = Col;
module.exports.cast = cast;
module.exports.Cast = Cast;
module.exports.literal = literal;
module.exports.Literal = Literal;
module.exports.json = json;
module.exports.where = where;
module.exports.Where = Where;
module.exports.List = List;
module.exports.Identifier = Identifier;
module.exports.JsonPath = JsonPath;
module.exports.AssociationPath = AssociationPath;
module.exports.Attribute = Attribute;
module.exports.Value = Value;
module.exports.sql = sql;
module.exports.and = and;
module.exports.or = or;
module.exports.SQL_NULL = SQL_NULL;
module.exports.JSON_NULL = JSON_NULL;

module.exports.AbstractQueryInterface = AbstractQueryInterface;
module.exports.AbstractConnectionManager = AbstractConnectionManager;
module.exports.AbstractQueryGenerator = AbstractQueryGenerator;
module.exports.AbstractQuery = AbstractQuery;
module.exports.AbstractDialect = AbstractDialect;

module.exports.Model = Model;

module.exports.Transaction = Transaction;
module.exports.TransactionNestMode = TransactionNestMode;
module.exports.TransactionType = TransactionType;
module.exports.Lock = Lock;
module.exports.IsolationLevel = IsolationLevel;

module.exports.Association = Association;
module.exports.BelongsToAssociation = BelongsToAssociation;
module.exports.HasOneAssociation = HasOneAssociation;
module.exports.HasManyAssociation = HasManyAssociation;
module.exports.BelongsToManyAssociation = BelongsToManyAssociation;

// Errors
Object.assign(module.exports, SequelizeErrors);

module.exports.useInflection = useInflection;

module.exports.QueryTypes = QueryTypes;
module.exports.Op = Op;
module.exports.TableHints = TableHints;
module.exports.IndexHints = IndexHints;
module.exports.DataTypes = DataTypes;
module.exports.GeoJsonType = GeoJsonType;
module.exports.Deferrable = Deferrable;
module.exports.ConstraintChecking = ConstraintChecking;
module.exports.ParameterStyle = ParameterStyle;

module.exports.Validator = Validator;

module.exports.ValidationErrorItemOrigin = ValidationErrorItemOrigin;
module.exports.ValidationErrorItemType = ValidationErrorItemType;

module.exports.isModelStatic = isModelStatic;
module.exports.isSameInitialModel = isSameInitialModel;
module.exports.importModels = importModels;
module.exports.ManualOnDelete = ManualOnDelete;
