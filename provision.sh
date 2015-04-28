sudo add-apt-repository ppa:vbernat/haproxy-1.5
wget -qO - https://packages.elasticsearch.org/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb http://packages.elasticsearch.org/elasticsearch/1.5/debian stable main" | sudo tee -a /etc/apt/sources.list
sudo apt-get update 
sudo apt-get install default-jre

#Mysql ----------
PASSWORD=''

sudo debconf-set-selections <<< "mysql-server-5.5 mysql-server/root_password password $PASSWORD"
sudo debconf-set-selections <<< "mysql-server-5.5 mysql-server/root_password_again password $PASSWORD"
sudo apt-get install -y mysql-server 2> /dev/null
sudo apt-get install -y mysql-client 2> /dev/null
echo "Removing bind-address"
# Or change it to '0.0.0.0'
sudo sed -i "s/^bind-address/#bind-address/" /etc/mysql/my.cnf

echo "Restarting MySQL"
sudo service mysql restart

if [ -e /vagrant/dump.sql ]
then
    echo "Loading dump"
    mysql -uroot -p$PASSWORD < /vagrant/dump.sql
fi

# Allow root to connect from anywhere
echo "Updating privileges"
mysql -uroot -p$PASSWORD <<< "GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY '$PASSWORD' WITH GRANT OPTION; FLUSH PRIVILEGES;"


##Redis ----------
sudo apt-get install make
wget http://download.redis.io/redis-stable.tar.gz
tar xvzf redis-stable.tar.gz
cd redis-stable
make
sudo make install
# Install the service using defaults
echo -e '' | sudo ./utils/install_server.sh

#Elasticsearch ----------
sudo apt-get install elasticsearch
sudo update-rc.d elasticsearch defaults 95 10

#Node ----------
sudo apt-get -y install nodejs npm
sudo ln -s /usr/bin/nodejs /usr/bin/node
sudo npm install -g forever
sudo npm install -g bower

# https://www.debian-administration.org/article/601/Easily_forwarding_arbitrary_TCP_connections_with_rinetd
sudo apt-get install -y rinetd

# Rails ----------
sudo apt-get install ruby-dev
sudo gem install compass


# Ember-cli ----------
sudo npm install -g ember-cli
sudo npm install -g node-haproxy
git clone git@github.com:Michieljoris/demo.git
cd demo
sudo npm install -g


#Haproxy ----------
# apt-get install -y haproxy
