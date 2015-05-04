apt-get update -qq; apt-get install -y git
apt-get install -y gcc make build-essential linux-headers-$(uname -r)
su -c "source /vagrant/setup_demo.sh" vagrant

