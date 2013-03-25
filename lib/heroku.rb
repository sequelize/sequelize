needs('HEROKU_USERNAME', 'HEROKU_API_KEY')

Heroku::Auth.instance_eval do
  # Autologin
  @credentials = [ENV['HEROKU_USERNAME'], ENV['HEROKU_API_KEY']]
  # Set up keys if there aren't any
  key_path = "#{home_directory}/.ssh/id_rsa.pub"
  if available_ssh_public_keys.empty?
    puts "Generating New Pair"
    generate_ssh_key("id_rsa")
    associate_key(key_path)
  end
  ::CURRENT_SSH_KEY = File.read(key_path)
end