# Quick Backbone/CoffeeScript tests to make sure that inheritance
# works correctly.

{ok, equal, deepEqual}      = require 'assert'
{Model, Collection, Events} = require '../backbone'


# Patch `ok` to store a count of passed tests...
count = 0
oldOk = ok
ok = ->
  oldOk arguments...
  count++


class Document extends Model

  fullName: ->
    @get('name') + ' ' + @get('surname')

tempest = new Document
  id      : '1-the-tempest',
  title   : "The Tempest",
  name    : "William"
  surname : "Shakespeare"
  length  : 123

ok tempest.fullName() is "William Shakespeare"
ok tempest.get('length') is 123


class ProperDocument extends Document

  fullName: ->
    "Mr. " + super

properTempest = new ProperDocument tempest.attributes

ok properTempest.fullName() is "Mr. William Shakespeare"
ok properTempest.get('length') is 123


console.log "passed #{count} tests"
