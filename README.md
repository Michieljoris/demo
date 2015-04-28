demo
--------

Not working yet!!

Deploy a branch of web app to a server with a git push and view the app at branch.somedomain.com

Demo is a command line utility to be used together with
[node-haproxy](https://github.com/michieljoris/node-haproxy). With it you can
can amongst other things stop, start, remove branches and add and remove repos


To see the whole thing in action without using a external server use the included
Vagrantfile:

    git clone git@github.com:Michieljoris/demo.git
    cd demo
    vagrant up
    vagrant ssh

Add your public ssh file to ~/.ssh/authorized_keys and exit

To then use this command line utility: 

    ssh vagrant@demo.local demo [params]

By setting an alias this can be shortened to:

    alias demo='ssh vagrant@demo.local'
    demo command [params]

Install dnsmasq to simulate local dns wildcard:

    sudo apt-get install dnsmasq
    sudo vi /etc/dnsmasq.conf 

Add this to dnsmasq.conf:

    address=/demo.local/10.0.0.2

And this to /etc/hosts

    demo.local 10.0.0.2

Then:

    sudo service dnsmasq restart

In a some github repo of a web app named myrepo:

    git remote add demo vagrant@demo.local:repos/myrepo
    demo create myrepo #creates bare git repo on server

Then in the repo:

    git push demo branchname

You should then be able visit the app at myrepo-branchname.demo.local



## Install

On your server:

    npm install -g node-haproxy
    git clone git@github.com:Michieljoris/demo.git
    cd demo
    npm install -g 
	
## Use

See [documentation](https://rawgithub.com/Michieljoris/demo/master/docs/demo.html).






