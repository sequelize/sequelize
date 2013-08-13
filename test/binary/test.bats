#!/usr/bin/env test/binary/bats/bin/bats

@test "no arguments prints usage instructions" {
  run bin/sequelize

  [ $status -eq 0 ]
  [ $(expr "${lines[0]}" : "Using environment 'development'.") -ne 0 ]
  [ $(expr "${lines[1]}" : "Try \"sequelize --help\" for usage information.") -ne 0 ]
}
