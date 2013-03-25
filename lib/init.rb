def needs(*names)
  names.each { |name| raise "ENV['#{name}'] required" unless ENV[name] }
end

require_relative 'heroku'
require_relative 'git'