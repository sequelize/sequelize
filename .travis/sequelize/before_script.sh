#!/bin/sh -e

if [ "COVERAGE"${COVERAGE} = "COVERAGEtrue" ] 
then
	mysql -e 'create database sequelize_test;'
	psql -c 'create database sequelize_test;' -U postgres
	npm install oracledb
else
	if [ "DIALECT"${DIALECT} = "DIALECToracle" ]
	then
	  #install oracledb only for dialect oracle
	  npm install oracledb
	else
		if [ "DIALECT"${DIALECT} = "DIALECTmariadb" ] || [ "DIALECT"${DIALECT} = "DIALECTmysql" ]
		then
			mysql -e 'create database sequelize_test;'
		else
			if [ "DIALECT"${DIALECT} = "DIALECTpostgres" ] || [ "DIALECT"${DIALECT} = "DIALECTpostgres-native" ]; then
				psql -c 'create database sequelize_test;' -U postgres
			fi
		fi
	fi
fi