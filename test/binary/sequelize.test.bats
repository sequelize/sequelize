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

