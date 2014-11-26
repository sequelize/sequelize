## Installation

You have two options to install Sequelize:

1&period; Install it via NPM:

```bash    
# Use npm on the commandline:
$ npm install sequelize

// Then require the installed library in your application code:
var Sequelize = require("sequelize")
```

2&period; Download the code from the git repository and require it's entry file index&period;js&colon;
    
```bash
# Checkout the current code from the repository using the commandline
$ cd path/to/lib
$ git clone git://github.com/sequelize/sequelize.git

// Then require the installed library in your application code&colon;

var Sequelize = require(__dirname + "/lib/sequelize/index")
```

This will make the class `Sequelize` available.