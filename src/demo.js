var VOW = require('dougs_vow');
var Path = require('path');
var haproxy = require('node-haproxy/src/ipc-client');
var spawn = require('child_process').spawn;
var util = require('util');

var shell = require('shelljs');

var fs = require('fs-extra');

var REPOS = Path.join(process.env.HOME, 'repos');

fs.ensureDirSync(REPOS);
var POSTRECEIVE = Path.resolve(__dirname,  '../scripts', 'post-receive.sh');

var repos = (function() {
  var repos = fs.readdirSync(REPOS);
  var result = {};
  repos.forEach(function(repo) {
    try {
      var dirs = fs.readdirSync(Path.join(REPOS, repo));
      var branches = [];
      if (dirs.indexOf('branches') !== -1) 
        branches = fs.readdirSync(Path.join(REPOS, repo, 'branches'));
      result[repo] = branches;
    } catch (e) {}
  });
  return result;
}());
console.log('Repos: ', repos);

var startCommands = {
  "ember-cli": { command: 'ember', args: ['s', '--proxy', 'http://localhost:3000', '-p']},
  "rails": { command: 'rails', args: ['s', '-p']}
};

var domain = '.local.me';

function createHaproxyRule(backend) {
  return {
    "type": "header"
    , "header": "host"            // the name of the HTTP header
    , "operation": "hdr_dom"
    , "value": backend + domain
    , "backend": backend // if rule is met, the backend to route the request to
    };
}

function createFrontend(name, bind, defaultBackend, backends) {
  return [name, {
    "bind": bind // IP and ports to bind to, comma separated, host may be *
    , "backend": defaultBackend      // the default backend to route to, it must be defined already
    , "rules": backends.map(function(backend) {
      return createHaproxyRule(backend);
    })
    // , "mode": "http"         // default: http, expects tcp|http
    // , "keepalive": "default"  // default: "default", expects default|close|server-close

  }];
}

function createBackend(id, domain,  port, pid) {
  return [id, {
    // "type" : "static" 
    // , "name" : backend
    // , "host" : backend + domain
     "members" : [{ host: domain, port: port, meta: { pid: pid }}]
  }];
}



function repoType(repo, branch) {
  var path = Path.join(REPOS, repo, 'branches', branch);
  var type;
  //test for config/application.rb with  require 'rails
  //test for Brocfile with require('ember-cli/lib/broccoli/ember-app');
  return type;
}

function startProcess(path, command) {
  var out = fs.openSync(path + '/out.log', 'a');
  var err = fs.openSync(path + '/out.log', 'a');

  var child = spawn(command.command, command.args, {
    cwd: path,
    detached: true,
    stdio: [ 'ignore', out, err ]
  });
  child.unref();

  console.log("pid", child.pid);
  return child.pid;
}

 
function exec(operation) {
  var vow = VOW.make();
  shell.exec(operation, function(status, output) {
    if (status !==0) vow.break(status);
    else vow.keep(output);
  });
  return vow.promise;
}

function init(args) {
  console.log('in init', args);
}

function checkout(repo, branch) {
  if (!repos[repo]) {
    error(null, 'Can\'t checkout from repo that doesn\'t exist');
    return;
  }
  
  branch = branch.split('/');
  branch = branch[branch.length-1];

  var workTree = Path.join(REPOS, repo, 'branches', branch);
  // console.log("Worktree: ", workTree);
  // console.log("Branch: ", branch);

  fs.ensureDirSync(workTree);

  var gitOperation = "git " + '--work-tree=' + workTree +
    " --git-dir=" + Path.join(REPOS, repo, 'bare') + " checkout " +  branch + " -f";

  // console.log(gitOperation);
  exec(gitOperation).when(
    function() {
      // var pid = fs.readFileSync(Path.join(REPOS, repo, 'pid'));
      // if (!pid) start(repo, branch);
      console.log('Done');
    },
    function(error) {
      // console.log('Error');
    });
}

function list(repo, branch) {
  console.log('in list', repo, branch);
  

}

function create(repo) {
  if (repos[repo]) {
    error(null, 'Repo already exists');
    return;
  }
  var repoPath = Path.join(REPOS, repo, 'bare');
  fs.ensureDirSync(repoPath);
  exec('cd ' + repoPath + ';git init --bare').when(
    function(out) {
      try {
        var postReceive = fs.readFileSync(POSTRECEIVE, { encoding: 'utf8' });
        postReceive = postReceive.replace('repo', repo);
        var postReceivePath = Path.join(repoPath, 'hooks/post-receive');
        fs.writeFileSync(postReceivePath, postReceive);
        console.log('Created repo ' + repo);
        return exec('chmod +x ' + postReceivePath);
      } catch(e) {
        return VOW.broken(e);
      }
    }).when(
      function(data) {
        if (data) console.log(data);
      },
      function(error) {
        console.log(error);
      }
    );

}

function deleteRepo(repo) { 
  var repoPath = Path.join(REPOS, repo);
  exec('rm -rf ' + repoPath)
    .when(
      function(data) {
        if (data) console.log(data);
      },
      function(error) {
        console.log(error);
      }
    );
  //TODO stop servers and remove backends from haproxy

}

function deleteBranch(repo, branch) { 
  var branchPath = Path.join(REPOS, repo, 'branches', branch);
  exec('rm -rf ' + branchPath)
    .when(
      function(data) {
        if (data) console.log(data);
      },
      function(error) {
        console.log(error);
      }
    );

  //TODO stop server and remove backend from haproxy
}



function online(repo, branch) {

}

function offline(repo, branch) {

}

function status(repo, branch) {

}


function url(repo, branch) {

}

function restart(repo) {

}


function start(repo, branch) {

}

function stop(repo, branch) {

}

function _do(operation, args) {
  var repo = args[0];
  var branch = args[1];
  
  if (!repo) {
    error(args, 'Name of repo missing');
    return;
  }

  if (!repos[repo]) {
    error(args, 'Unknown repo');
    return;
  }

  if (!branch) {
    operation = operations.internal.repos[operation];
    if (!operation) {
      error(args, 'Unknown operation for repo');
    }
    else operation(repo);
    return;
  }

  operation = operations.internal.branches[operation];
  if (!operation) {
    error(args, 'Unknown operation for branch');
    return;
  }
  operation(repo, branch);
}



function error(args, msg) {
  if (msg) console.log(msg);
  var txt = [
    "create <repo>                : create a bare git repo on the server",
    "delete <repo> [<branch]      : delete repo or just a branch",
    "list [<repo>]                : list all branches (or just for repo)",
    "checkout <repo> <branch>     : access branch at repo-branch.domain.com",
    "start <repo> <branch>        : start web server for branch",
    "stop <repo> <branch>         : stop web server for branch",
    "online <repo> <branch>       : take web server online for branch",
    "offline <repo> <branch>      : take web server offline for branch",
    "offline <repo> <branch>      : take web server offline for branch",
    "info <repo> <branch>         : status and url foreckoubranch",
    "exec <repo> <branch>         : execute command in branch folder",
    "init                         : ",
    "\nTo add a remote to a repo:",
    "git remote add demo user@demo.com:repos/myrepo/bare"
  ];
  console.log(txt.join('\n'));
}

var operations = {
  public: {
    create: function(args) {
      create(args[0]);
    },
    checkout: function(args) {
      _do('checkout', args);
    },
    list: function(args) {
      if (!args.length) list();
      else _do('list', args);
    },
    delete: function(args) {
      _do('delete', args);
    },
    init: init
  },
  internal: {
    repos: {
      list: list,
      create: create,
      delete: deleteRepo
    },
    branches: {
      list: list,
      checkout: checkout,
      delete: deleteBranch
    }
  }
};

module.exports = function(operation, args) {
  operation = operations.public[operation] || error;
  operation(args);
};

// module.exports('checkout', ['bla','a/b/c/branch']);


