demo
--------

Working but needs testing.

Deploy a branch of web app to a server with a git push and view the app at branch.somedomain.com

Demo is a command line utility to be used together with
[node-haproxy](https://github.com/michieljoris/node-haproxy). With it you can
can amongst other things stop, start, remove branches and add and remove repos


To see the whole thing in action without using a external server use the included
Vagrantfile:

    git clone https://github.com/Michieljoris/demo.git
    cd demo
    vagrant up
    vagrant ssh

Add your public ssh file to ~/.ssh/authorized_keys and exit

And this to /etc/hosts

    demo.local 10.0.0.2
    someapp-master.demo.local 10.0.0.2
    someapp-somebranch.demo.local 10.0.0.2

Use this command line utility: 

    ssh vagrant@demo.local demo [params]

By setting an alias this can be shortened to:

    alias demo='ssh vagrant@demo.local'
    demo command [params]

In a some github repo of a web app named someapp, in the master branch:

    git remote add demo vagrant@demo.local:repos/someapp/bare
    demo create someapp #creates bare git repo on server

Add a file called demo.json to the root folder of your app:

{
    "start": "node server.js -p PORT",
    "restartOnCheckout": false
}

Replace 'node server.js with the command to start your server, You need to add
the option to set the port and set it to PORT. It gets replaced with an actual
port when demo executes the command. Other branches will use this demo.json as
well. If some branch is using a different start up command give it its own demo.json.

Then in the repo:

    git add -A; git commit -m 'added demo.json'; git push demo master

You should then be able visit the app at someapp-master.demo.local

Then:

    git push demo somebranch

Visit this branch at someapp-somebranch.demo.local

Rinse and repeat for other repos and branches

## Install on server

    npm install -g node-haproxy
    node-haproxy --ipc &
    git clone https://github.com/Michieljoris/demo.git

Get a wildcard domain to point to your server. Modify src/demo.js in the
demo folder and set the domain variable to your domain.

    cd demo
    npm install -g 

Use 'demo bind *:<port>' to bind haproxy to a port and ip address.

# Use

You can manage the server with the demo utility you installed on the server.

Calling it without arguments  will output this:

    Help:
    create repo              : create a bare git repo on the server
    delete repo [branch]     : delete repo or just a branch
    urls [repo]              : list urls (or just for repo)
    url repo branch          : print url for repo-branch
    checkout repo branch     : access branch at repo-branch.domain.com
    start repo branch        : start web server for branch
    stop repo branch         : stop web server for branch
    online repo branch       : take web server online for branch
    offline repo branch      : take web server offline for branch
    status                   : status of server
    log repo branch          : print log of server in branch
    exec repo branch         : execute command in branch folder
    bind url                 : domain:port of frontend proxy
    version                  : print version
    help                     : this help text

    To add a remote to a repo:
    git remote add demo user@demo.com:repos/myrepo/bare

    Serve app online at myrepo-branch.domain.com:
    git push demo branch

online/offline basically add/remove an rule in the frontend section of the
haproxy.config

start/stop actually stop/start a server. To enable a server a server to start
add a file called demo.json to the repo your demoing with the following content:

{
    "init": ["echo 'this is not yet implemented..'"], 
    "start": "bb-server -p PORT",
    "restartOnCheckout": true
}

Whatever command you set for start it should contain the capitilized word
'PORT'. It gets replaced with an available port within a certain range (see
demo.js);

Any output from the server to the console gets written to out.log in the
branch's folder. Read it with 'demo log repo branch'

The server needs an outside port open, and haproxy needs to bind to it, use
something like 'demo bind *:8080' to set/change it. The included haproxy runs in
user space so you can't bind to a port under 1000. If you want your demo urls to
be without port install something like rinetd of fiddle with ip-rules to
redirect port 80 to the haproxy proxy.

Wipe a branch or a whole repo, including all its branches with delete repo
[branch]. This also kills the servers involved. 

The checkout command is meant for use in the git post-receive hook. It checks
out a branch from repos/<repo>/bare to repos/<repo>/branches/<branch> and starts
the server if demo.json is found in the branch folder. 

Execute a command in a repo/branch folder with exec repo branch.

Domain is hard coded in demo.js at the moment (demo.local). It works in the
accompanying Vagrantfile. It HAS to match the domain name used to get to your
server.If you use a online server you need a wildcard domain pointing to it. If
it is *.somedomain.com, you need to set the domain variable in demo.js to
.somedomain.com. See TODO below.

How it all works is that the demo utility on every invocation finds the pids of
all servers withing a certain range.It then looks for the current working
directory of all those pids. The ones that match a
repos/<repo>/branches/<branch> folder are running demo servers. It then makes
sure that haproxy.config is set up properly to match the current server status.
Haproxy then routes something like somerepo-somebranch.somedomain.com to the
right server.

This is easy to manage and pretty foolproof, as long as a server (script) does
not change working directoy for its process. Rogue (wrong cwd) and orphan
servers (cwd deleted) also get picked up but are not managed at the moment. I
don't need to record and store pids and ports this way.

Node-haproxy is a long running process. The demo util only runs as long as is
needed to execute a command. ipc-node is used to communicate between the two
processes.


# Todo

* ssl
* node-haproxy is still a bit flaky, as in it can crash on wrong commands, just
restart it, you could use forever to get around this for now
* disable debug output 
* have demo read a config file. Settings like domain, port range, folder
  locations are hard coded in demo.js at the moment
* implement running the 'init' command in demo.json on first checkout of a branch.




