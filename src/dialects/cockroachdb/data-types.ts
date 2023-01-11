import * as DataTypes from '../postgres/data-types';

DataTypes.GEOGRAPHY.prototype.getBindParamSql = (value, options): string => {
  return `ST_GeomFromGeoJSON(${options.bindParam(value)}::json)::geography`;
};

export default DataTypes;
