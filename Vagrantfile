# -*- mode: ruby -*-
# vi: set ft=ruby :

BOX_NAME = ENV["BOX_NAME"] || "trusty"
BOX_URI = ENV["BOX_URI"] || "https://cloud-images.ubuntu.com/vagrant/trusty/current/trusty-server-cloudimg-amd64-vagrant-disk1.box"
BOX_MEMORY = ENV["BOX_MEMORY"] || "1024"
DEMO_DOMAIN = ENV["DEMO_DOMAIN"] || "demo.local"
DEMO_IP = ENV["DEMO_IP"] || "10.0.0.2"


# All Vagrant configuration is done below. The "2" in Vagrant.configure
# configures the configuration version (we support older styles for
# backwards compatibility). Please don't change it unless you know what
# you're doing.
Vagrant.configure(2) do |config|
  # The most common configuration options are documented and commented below.
  # For a complete reference, please see the online documentation at
  # https://docs.vagrantup.com.

  # Every Vagrant development environment requires a box. You can search for
  # boxes at https://atlas.hashicorp.com/search.
  # config.vm.box = "precise64"
  config.vm.box = BOX_NAME

  # config.vm.box_url = "http://files.vagrantup.com/precise64.box"
  config.vm.box_url = BOX_URI
  # config.vm.synced_folder File.dirname(__FILE__), "/srv/dokku-alt"
  config.vm.network :forwarded_port, guest: 80, host: 8888
  config.vm.hostname = "#{DEMO_DOMAIN}"
  config.vm.network :private_network, ip: DEMO_IP

  config.vm.provider :virtualbox do |vb|
    vb.customize ["modifyvm", :id, "--natdnshostresolver1", "on"]
    # Ubuntu's Raring 64-bit cloud image is set to a 32-bit Ubuntu OS type by
    # default in Virtualbox and thus will not boot. Manually override that.
    vb.customize ["modifyvm", :id, "--ostype", "Ubuntu_64"]
    vb.customize ["modifyvm", :id, "--memory", BOX_MEMORY]
  end

  # Configure docker apt sources
  # config.vm.provision :shell, :inline => "apt-get update -qq"
  # config.vm.provision :shell, :inline => "apt-get install -y apt-transport-https git"
  # config.vm.provision :shell, :inline => "apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys 36A1D7869245C8950F966E92D8576A8BA88D21E9"
  # config.vm.provision :shell, :inline => "echo deb https://get.docker.io/ubuntu docker main > /etc/apt/sources.list.d/docker.list"
  # config.vm.provision :shell, :inline => "apt-get update -qq"


  # Disable automatic box update checking. If you disable this, then
  # boxes will only be checked for updates when the user runs
  # `vagrant box outdated`. This is not recommended.
  # config.vm.box_check_update = false

  # Create a forwarded port mapping which allows access to a specific port
  # within the machine from a port on the host machine. In the example below,
  # accessing "localhost:8080" will access port 80 on the guest machine.
  # config.vm.network "forwarded_port", guest: 80, host: 8080

  # Create a private network, which allows host-only access to the machine
  # using a specific IP.
  # config.vm.network "private_network", ip: "192.168.33.10"

  # Create a public network, which generally matched to bridged network.
  # Bridged networks make the machine appear as another physical device on
  # your network.
  # config.vm.network "public_network"

  # Share an additional folder to the guest VM. The first argument is
  # the path on the host to the actual folder. The second argument is
  # the path on the guest to mount the folder. And the optional third
  # argument is a set of non-required options.
  # config.vm.synced_folder "/home/michieljoris/tmp/vagrant_data", "/vagrant_data"
  config.vm.synced_folder "repos", "/home/vagrant/repos"

  # Provider-specific configuration so you can fine-tune various
  # backing providers for Vagrant. These expose provider-specific options.
  # Example for VirtualBox:
  #
  # config.vm.provider "virtualbox" do |vb|
  #   # Display the VirtualBox GUI when booting the machine
  #   vb.gui = true
  #
  #   # Customize the amount of memory on the VM:
  #   vb.memory = "1024"
  # end
  #
  # View the documentation for the provider you are using for more
  # information on available options.

  # Define a Vagrant Push strategy for pushing to Atlas. Other push strategies
  # such as FTP and Heroku are also available. See the documentation at
  # https://docs.vagrantup.com/v2/push/atlas.html for more information.
  # config.push.define "atlas" do |push|
  #   push.app = "YOUR_ATLAS_USERNAME/YOUR_APPLICATION_NAME"
  # end

  # Enable provisioning with a shell script. Additional provisioners such as
  # Puppet, Chef, Ansible, Salt, and Docker are also available. Please see the
  # documentation for more information about their specific syntax and use.
  # config.vm.provision "shell", inline: <<-SHELL
  #   sudo apt-get update
  #   sudo apt-get install -y apache2
  # SHELL
# Create a forwarded port mapping which allows access to a specific port
  # within the machine from a port on the host machine. In the example below,
  # accessing "localhost:8080" will access port 80 on the guest machine.
  # config.vm.network "forwarded_port", guest: 80, host: 8080
  # config.vm.network :forwarded_port, guest: 3306, host: 3306
  # config.vm.network :forwarded_port, guest: 6379, host: 6379

  # See http://www.thisprogrammingthing.com/2013/getting-started-with-vagrant/
  # Provisin Vagrant with node, npm, forever, bower, node-haproxy and demo:
  config.vm.provision :shell, :inline => "apt-get update -qq; apt-get install git"
  config.vm.provision :shell, :inline => "apt-get install gcc make build-essential linux-headers-$(uname -r)"
  config.vm.provision :shell, :path => "provision-node.sh"

  # comment out the last three lines and uncomment the next one to provision
  # Vagrant with mysql, redis, JRE, elasticsearch, rinetd, ruby 2.1, bundler,
  # compass, node, npm, bower, forever ember-cli, node-haproxy and demo

  # config.vm.provision :shell, :path => "provision.sh"
  # config.vm.provision :shell, :path => "provision-node.sh"
  # config.vm.provision :shell, :path => "provision-ember.sh"
  

end
