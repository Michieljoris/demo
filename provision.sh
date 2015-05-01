# sudo add-apt-repository ppa:vbernat/haproxy-1.5
wget -qO - https://packages.elasticsearch.org/GPG-KEY-elasticsearch | sudo apt-key add -
echo "deb http://packages.elasticsearch.org/elasticsearch/1.5/debian stable main" | sudo tee -a /etc/apt/sources.list

sudo apt-get update 

#Mysql ----------
sudo debconf-set-selections <<< 'mysql-server mysql-server/root_password password root'
sudo debconf-set-selections <<< 'mysql-server mysql-server/root_password_again password root'
sudo apt-get install -y python-software-properties
sudo apt-get update
sudo apt-get -y install mysql-server
sed -i "s/^bind-address/#bind-address/" /etc/mysql/my.cnf
mysql -u root -proot -e "GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY 'root' WITH GRANT OPTION; FLUSH PRIVILEGES;"
sudo /etc/init.d/mysql restart


# PASSWORD=''

# sudo debconf-set-selections <<< "mysql-server-5.5 mysql-server/root_password password $PASSWORD"
# sudo debconf-set-selections <<< "mysql-server-5.5 mysql-server/root_password_again password $PASSWORD"
# sudo apt-get install -y mysql-server 2> /dev/null
# sudo apt-get install -y mysql-client 2> /dev/null
# echo "Removing bind-address"
# # Or change it to '0.0.0.0'
# sudo sed -i "s/^bind-address/#bind-address/" /etc/mysql/my.cnf

# echo "Restarting MySQL"
# sudo service mysql restart

if [ -e /vagrant/dump.sql ]
then
    echo "Loading dump"
    mysql -uroot -p$PASSWORD < /vagrant/dump.sql
fi

# # Allow root to connect from anywhere
# echo "Updating privileges"
# mysql -uroot -p$PASSWORD <<< "GRANT ALL PRIVILEGES ON *.* TO 'root'@'%' IDENTIFIED BY '$PASSWORD' WITH GRANT OPTION; FLUSH PRIVILEGES;"


# ##Redis ----------
sudo apt-get install -y make
wget http://download.redis.io/redis-stable.tar.gz
tar xvzf redis-stable.tar.gz
rm  redis-stable.tar.gz
cd redis-stable
make
sudo make install

# Install the service using defaults
echo -e '' | sudo ./utils/install_server.sh

#And remove leftovers
cd ..
rm -rf redis-stable

#Elasticsearch ----------
sudo apt-get -y install default-jre git
sudo apt-get  install -y elasticsearch
sudo update-rc.d elasticsearch defaults 95 10
sudo service elasticsearch start

# https://www.debian-administration.org/article/601/Easily_forwarding_arbitrary_TCP_connections_with_rinetd
sudo apt-get install -y rinetd

#Other ways to install Ruby
# wget http://cache.ruby-lang.org/pub/ruby/ruby-2.1.5.tar.gz
# tar xf ruby-2.0.0-p598.tar.gz
# cd /ruby-2.0.0-p598 && ./configure
# cd /ruby-2.0.0-p598 && make 
# cd /ruby-2.0.0-p598 && make install

sudo apt-get install -y python-software-properties
sudo apt-add-repository ppa:brightbox/ruby-ng
sudo apt-get update
sudo apt-get -y install ruby2.1 ruby2.1-dev

# Rails ----------
# sudo apt-get install -y ruby-dev
# echo 'export PATH="$HOME/.rbenv/bin:$PATH"' >> ~/.bashrc
# echo 'eval "$(rbenv init -)"' >> ~/.bashrc
# git clone https://github.com/sstephenson/rbenv.git ~/.rbenv
# git clone https://github.com/sstephenson/ruby-build.git ~/.rbenv/plugins/ruby-build
# . ~/.bashrc
# rbenv install 2.1.5
# rbenv global 2.1.5

sudo gem install bundler
sudo gem install compass
sudo apt-get install -y libmysqlclient-dev # for mysql2 gem

#Node ----------
sudo apt-get -y install nodejs npm
sudo ln -s /usr/bin/nodejs /usr/bin/node
sudo npm install -g forever
sudo npm install -g bower

# Ember-cli ----------
sudo npm install -g ember-cli
sudo npm install -g node-haproxy
git clone https://github.com/Michieljoris/demo.git
cd demo
sudo npm install -g

#Haproxy ----------
# apt-get -y install -y haproxy
