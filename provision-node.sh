#Node ----------
mkdir ~/opt
cd opt
wget http://nodejs.org/dist/v0.12.2/node-v0.12.2-linux-x64.tar.gz
tar xf node-v0.12.2-linux-x64.tar.gz
ln -s node-v0.12.2-linux-x64 nodejs
mkdir ~/bin
cd ~/bin
ln -s ../opt/nodejs/bin/node
ln -s ../opt/nodejs/bin/npm
cd ~/

#Putting it at the front of .bashrc to make sure PATH gets set even when issuing commands using ssh:
{ echo 'export PATH=~/bin:$PATH'; cat .bashrc; } > tmpfile; mv tmpfile .bashrc

npm install -g forever

# demo
git clone https://github.com/Michieljoris/node-haproxy.git
forever -l ~/node-haproxy.log -a start ~/node-haproxy/bin/node-haproxy.js --ipc

git clone https://github.com/Michieljoris/demo.git
cd demo; npm install -g; cd ../
