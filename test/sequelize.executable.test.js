var chai      = require('chai')
  , expect    = chai.expect
  , Support   = require(__dirname + '/support')
  , DataTypes = require(__dirname + "/../lib/data-types")
  , dialect   = Support.getTestDialect()
  , _         = require('lodash')
  , exec      = require('child_process').exec
  , version   = (require(__dirname + '/../package.json')).version

chai.Assertion.includeStack = true

describe(Support.getTestDialectTeaser("Executable"), function() {
  describe('call without arguments', function() {
    it("prints usage instructions", function(done) {
      exec('bin/sequelize', function(err, stdout, stderr) {
        expect(stdout).to.include("No action specified. Try \"sequelize --help\" for usage information.")
        done()
      })
    })
  })

  ;(function(flags) {
    flags.forEach(function(flag) {
      describe(flag, function() {
        it("prints the help", function(done) {
          exec("bin/sequelize " + flag, function(err, stdout, stderr) {
            expect(stdout).to.include("Usage: sequelize [options]")
            done()
          })
        })
      })
    })
  })(["--help", "-h"])

  ;(function(flags) {
    flags.forEach(function(flag) {
      describe(flag, function() {
        it("prints the help", function(done) {
          exec("bin/sequelize " + flag, function(err, stdout, stderr) {
            expect(version).to.not.be.empty
            expect(stdout).to.include(version)
            done()
          })
        })
      })
    })
  })(['--version', '-V'])

  ;(function(flags) {
    flags.forEach(function(flag) {
      describe(flag, function() {
        ;(function(folders) {
          folders.forEach(function(folder) {
            it("creates a '" + folder + "' folder", function(done) {
              exec("rm -rf ./*", { cwd: __dirname + '/tmp' }, function() {
                exec("../../bin/sequelize --init", { cwd: __dirname + '/tmp' }, function() {
                  exec("ls -ila", { cwd: __dirname + '/tmp' }, function(err, stdout) {
                    expect(stdout).to.include(folder)
                    done()
                  })
                })
              })
            })
          })
        })(['config', 'migrations'])

        it("creates a config.json file", function(done) {
          exec("rm -rf ./*", { cwd: __dirname + '/tmp' }, function() {
            exec("../../bin/sequelize --init", { cwd: __dirname + '/tmp' }, function() {
              exec("ls -ila config", { cwd: __dirname + '/tmp' }, function(err, stdout) {
                expect(stdout).to.include('config.json')
                done()
              })
            })
          })
        })

        it("does not overwrite an existing config.json file", function(done) {
          exec("rm -rf ./*", { cwd: __dirname + '/tmp' }, function() {
            exec("../../bin/sequelize --init", { cwd: __dirname + '/tmp' }, function() {
              exec("echo 'foo' > config/config.json", { cwd: __dirname + '/tmp' }, function() {
                exec("../../bin/sequelize --init", { cwd: __dirname + '/tmp' }, function(err) {
                  expect(err.code).to.equal(1)
                  exec("cat config/config.json", { cwd: __dirname + '/tmp' }, function(err, stdout) {
                    expect(stdout).to.equal("foo\n")
                    done()
                  })
                })
              })
            })
          })
        })
      })
    })
  })(['--init', '-i'])
})
