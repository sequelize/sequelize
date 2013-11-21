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

  ;(function(flags) {
    flags.forEach(function(flag) {
      var prepare = function(callback) {
        exec("rm -rf ./*", { cwd: __dirname + '/tmp' }, function() {
          exec("../../bin/sequelize --init", { cwd: __dirname + '/tmp' }, function() {
            exec("../../bin/sequelize " + flag + " 'foo'", { cwd: __dirname + '/tmp' }, callback)
          })
        })
      }

      describe(flag, function() {
        it("creates a new file with the current timestamp", function(done) {
          prepare(function() {
            exec("ls -1 migrations", { cwd: __dirname + '/tmp' }, function(err, stdout) {
              var date   = new Date()
                , format = function(i) { return (parseInt(i, 10) < 10 ? '0' + i : i)  }
                , sDate  = [date.getFullYear(), format(date.getMonth() + 1), format(date.getDate()), format(date.getHours()), format(date.getMinutes())].join('')

              expect(stdout).to.match(new RegExp(sDate + "..-foo.js"))
              done()
            })
          })
        })

        it("adds a skeleton with an up and a down method", function(done) {
          prepare(function() {
            exec("cat migrations/*-foo.js", { cwd: __dirname + '/tmp' }, function(err, stdout) {
              expect(stdout).to.include('up: function(migration, DataTypes, done) {')
              expect(stdout).to.include('down: function(migration, DataTypes, done) {')
              done()
            })
          })
        })

        it("calls the done callback", function(done) {
          prepare(function() {
            exec("cat migrations/*-foo.js", { cwd: __dirname + '/tmp' }, function(err, stdout) {
              expect(stdout).to.include('done()')
              expect(stdout.match(/(done\(\))/)).to.have.length(2)
              done()
            })
          })
        })
      })
    })
  })(['--create-migration', '-c'])

  ;(function(flags) {
    flags.forEach(function(flag) {
      var prepare = function(callback) {
        exec("rm -rf ./*", { cwd: __dirname + '/tmp' }, function(error, stdout) {
          exec("../../bin/sequelize --init", { cwd: __dirname + '/tmp' }, function(error, stdout) {
            exec("cp ../assets/migrations/*-createPerson.js ./migrations/", { cwd: __dirname + '/tmp' }, function(error, stdout) {
              exec("cat ../support.js|sed s,/../,/../../, > ./support.js", { cwd: __dirname + '/tmp' }, function(error, stdout) {
                var dialect = Support.getTestDialect()
                  , config  = require(__dirname + '/config/config.js')

                config.sqlite.storage = __dirname + "/tmp/test.sqlite"
                config = _.extend(config, config[dialect], { dialect: dialect })

                exec("echo '" + JSON.stringify(config) + "' > config/config.json", { cwd: __dirname + '/tmp' }, function(error, stdout) {
                  exec("../../bin/sequelize " + flag, { cwd: __dirname + "/tmp" }, callback)
                })
              })
            })
          })
        })
      }

      describe(flag, function() {
        it("creates a SequelizeMeta table", function(done) {
          var sequelize = this.sequelize

          if (this.sequelize.options.dialect === 'sqlite') {
            var options = this.sequelize.options
            options.storage = __dirname + "/tmp/test.sqlite"
            sequelize = new Support.Sequelize("", "", "", options)
          }

          prepare(function() {
            sequelize.getQueryInterface().showAllTables().success(function(tables) {
              tables = tables.sort()

              expect(tables).to.have.length(2)
              expect(tables[1]).to.equal("SequelizeMeta")
              done()
            })
          }.bind(this))
        })

        it("creates the respective table", function(done) {
          var sequelize = this.sequelize

          if (this.sequelize.options.dialect === 'sqlite') {
            var options = this.sequelize.options
            options.storage = __dirname + "/tmp/test.sqlite"
            sequelize = new Support.Sequelize("", "", "", options)
          }

          prepare(function() {
            sequelize.getQueryInterface().showAllTables().success(function(tables) {
              tables = tables.sort()

              expect(tables).to.have.length(2)
              expect(tables[0]).to.equal("Person")
              done()
            })
          }.bind(this))
        })
      })
    })
  })(['--migrate', '-m'])
})
