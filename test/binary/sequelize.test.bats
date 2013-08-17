#!/usr/bin/env test/binary/bats/bin/bats

@test "no arguments prints usage instructions" {
  run bin/sequelize

  [ $status -eq 0 ]
  [ $(expr "${lines[0]}" : "Using environment 'development'.") -ne 0 ]
  [ $(expr "${lines[1]}" : "Try \"sequelize --help\" for usage information.") -ne 0 ]
}

@test "--help prints the help" {
  run bin/sequelize --help

  [ $status -eq 0 ]
  [ "${lines[0]}" = "  Usage: sequelize [options]" ]
}

@test "-h prints the help" {
  run bin/sequelize -h

  [ $status -eq 0 ]
  [ "${lines[0]}" = "  Usage: sequelize [options]" ]
}

@test "--version prints the current version" {
  run bin/sequelize --version
  [ $status -eq 0 ]
  [ "${lines[0]}" = `cat package.json|grep version|cut -f2 -d:|cut -f2 -d\"` ]
}

@test "-V prints the current version" {
  run bin/sequelize -V
  [ $status -eq 0 ]
  [ "${lines[0]}" = `cat package.json|grep version|cut -f2 -d:|cut -f2 -d\"` ]
}

@test "--init creates a config folder" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize --init

  run ls -ila
  [ $status -eq 0 ]
  [ $(echo "${output}" | grep -b -o "config"|cut -d: -f1) -gt 0 ]

  cd ../../..
}

@test "--init creates a migrations folder" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize --init

  run ls -ila
  [ $status -eq 0 ]
  [ $(echo "${output}" | grep -b -o "migrations"|cut -d: -f1) -gt 0 ]

  cd ../../..
}

@test "--init creates a config.json file" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize --init

  run ls -ila config
  [ $status -eq 0 ]
  [ $(echo "${output}" | grep -b -o "config.json"|cut -d: -f1) -gt 0 ]

  cd ../../..
}

@test "--init does not overwrite an existing config.json file" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize --init
  echo "foo" > config/config.json
  run ../../../bin/sequelize --init
  [ $status -eq 1 ]
  run cat config/config.json
  [ $status -eq 0 ]
  [ "${lines[0]}" = "foo" ]
  cd ../../..
}

@test "--init does overwrite an existing config.json file if --force is added" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize --init
  echo "foo" > config/config.json
  run ../../../bin/sequelize --init -f
  [ $status -eq 0 ]
  run cat config/config.json
  [ $status -eq 0 ]
  [ "${lines[0]}" != "foo" ]
  cd ../../..
}

@test "-i creates a config folder" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize -i

  run ls -ila
  [ $status -eq 0 ]
  [ $(echo "${output}" | grep -b -o "config"|cut -d: -f1) -gt 0 ]

  cd ../../..
}

@test "-i creates a migrations folder" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize -i

  run ls -ila
  [ $status -eq 0 ]
  [ $(echo "${output}" | grep -b -o "migrations"|cut -d: -f1) -gt 0 ]

  cd ../../..
}

@test "-i creates a config.json file" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize -i

  run ls -ila config
  [ $status -eq 0 ]
  [ $(echo "${output}" | grep -b -o "config.json"|cut -d: -f1) -gt 0 ]

  cd ../../..
}

@test "-i does not overwrite an existing config.json file" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize -i
  echo "foo" > config/config.json
  run ../../../bin/sequelize -i
  [ $status -eq 1 ]
  run cat config/config.json
  [ $status -eq 0 ]
  [ "${lines[0]}" = "foo" ]
  cd ../../..
}

@test "-i does overwrite an existing config.json file if --force is added" {
  cd test/binary/tmp
  rm -rf ./*
  ../../../bin/sequelize -i
  echo "foo" > config/config.json
  run ../../../bin/sequelize -i -f
  [ $status -eq 0 ]
  run cat config/config.json
  [ $status -eq 0 ]
  [ "${lines[0]}" != "foo" ]
  cd ../../..
}

@test "--env switches the environment" {
  run bin/sequelize --env production

  [ $status -eq 0 ]
  [ $(expr "${lines[0]}" : "Using environment 'production'.") -ne 0 ]
}

@test "-e switches the environment" {
  run bin/sequelize -e production

  [ $status -eq 0 ]
  [ $(expr "${lines[0]}" : "Using environment 'production'.") -ne 0 ]
}

@test "--create-migration creates a new file with the current timestamp" {
  cd test/binary/tmp
  rm -rf ./*

  ../../../bin/sequelize -i
  ../../../bin/sequelize --create-migration "foo"

  needle=`node -e "var d=new Date(); var f=function(i){ return (parseInt(i, 10) < 10 ? '0' + i : i)  }; console.log([d.getFullYear(), f(d.getMonth() + 1), f(d.getDate()), f(d.getHours()), f(d.getMinutes()), f(d.getSeconds())].join(''))"`
  run ls -1 migrations

  [ $status -eq 0 ]
  [ $(expr "${lines[0]}" : "${needle}-foo.js") -ne 0 ]

  cd ../../..
}

@test "--create-migration adds a skeleton with an up and a down method" {
  cd test/binary/tmp
  rm -rf ./*

  ../../../bin/sequelize -i
  ../../../bin/sequelize --create-migration "foo"

  run cat migrations/*-foo.js

  [ $status -eq 0 ]
  [ $(expr "${lines[1]}" : "  up: function(migration, DataTypes, done) {") -ne 0 ]
  [ $(expr "${lines[5]}" : "  down: function(migration, DataTypes, done) {") -ne 0 ]

  cd ../../..
}

@test "--create-migration calls the done callback" {
  cd test/binary/tmp
  rm -rf ./*

  ../../../bin/sequelize -i
  ../../../bin/sequelize --create-migration "foo"

  run cat migrations/*-foo.js

  [ $status -eq 0 ]
  [ $(expr "${lines[3]}" : "    done()") -ne 0 ]
  [ $(expr "${lines[7]}" : "    done()") -ne 0 ]

  cd ../../..
}

@test "-c creates a new file with the current timestamp" {
  cd test/binary/tmp
  rm -rf ./*

  ../../../bin/sequelize -i
  ../../../bin/sequelize -c "foo"

  needle=`node -e "var d=new Date(); var f=function(i){ return (parseInt(i, 10) < 10 ? '0' + i : i)  }; console.log([d.getFullYear(), f(d.getMonth() + 1), f(d.getDate()), f(d.getHours()), f(d.getMinutes()), f(d.getSeconds())].join(''))"`
  run ls -1 migrations

  [ $status -eq 0 ]
  [ $(expr "${lines[0]}" : "${needle}-foo.js") -ne 0 ]

  cd ../../..
}

@test "-c adds a skeleton with an up and a down method" {
  cd test/binary/tmp
  rm -rf ./*

  ../../../bin/sequelize -i
  ../../../bin/sequelize -c "foo"

  run cat migrations/*-foo.js

  [ $status -eq 0 ]
  [ $(expr "${lines[1]}" : "  up: function(migration, DataTypes, done) {") -ne 0 ]
  [ $(expr "${lines[5]}" : "  down: function(migration, DataTypes, done) {") -ne 0 ]

  cd ../../..
}

@test "-c calls the done callback" {
  cd test/binary/tmp
  rm -rf ./*

  ../../../bin/sequelize -i
  ../../../bin/sequelize -c "foo"

  run cat migrations/*-foo.js

  [ $status -eq 0 ]
  [ $(expr "${lines[3]}" : "    done()") -ne 0 ]
  [ $(expr "${lines[7]}" : "    done()") -ne 0 ]

  cd ../../..
}
