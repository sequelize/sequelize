var config = module.exports

config["node tests"] = {
  environment: "node",
  timeout: 500,
  rootPath: "../",
  tests: [
    "spec/**/*.spec.js"
  ]
}
