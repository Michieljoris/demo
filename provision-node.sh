#Node ----------
mkdir ~/opt ~/bin
cd ~/opt
wget http://nodejs.org/dist/v0.10.38/node-v0.10.38-linux-x64.tar.gz
tar xf node-v0.10.38-linux-x64.tar.gz
ln -s node-v0.10.38-linux-x64 nodejs
ln -s ~/opt/nodejs/bin/node ~/bin/node
ln -s ~/opt/nodejs/bin/npm ~/bin/npm
cd ~/

#Putting it at the front of .bashrc to make sure PATH gets set even when issuing commands using ssh:
{ echo 'export PATH=~/bin:$PATH'; cat .bashrc; } > tmpfile; mv tmpfile .bashrc

. ~/.bashrc

npm install -g forever

git clone https://github.com/Michieljoris/demo.git
cd demo; npm install
forever -l ~/node-haproxy.log -a start ~/demo/node_modules/node-haproxy/bin/node-haproxy.js --ipc
ln -s ~/demo/src/command.js ~/bin/demo
