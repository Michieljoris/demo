var VOW = require('dougs_vow');
var Path = require('path');
var haproxy = require('node-haproxy/src/ipc-client');
var spawn = require('child_process').spawn;
var util = require('util');
var shell = require('shelljs');
var fs = require('fs-extra');

var utils = require('./utils');

var domain = '.local.me';

var REPOS = Path.join(process.env.HOME, 'repos');
fs.ensureDirSync(REPOS);

var POSTRECEIVE = Path.resolve(__dirname,  '../scripts', 'post-receive.sh');
var MINPORT = 8000, MAXPORT = 9000;

var repos;
var serverStatus;

// var repos = (function() {
//   var repos = fs.readdirSync(REPOS);
//   var result = {};
//   repos.forEach(function(repo) {
//     try {
//       var dirs = fs.readdirSync(Path.join(REPOS, repo));
//       var branches = [];
//       if (dirs.indexOf('branches') !== -1) 
//         branches = fs.readdirSync(Path.join(REPOS, repo, 'branches'));
//       result[repo] = branches;
//     } catch (e) {}
//   });
//   return result;
// }());
// console.log('Repos: ', repos);

var startCommands = {
  "ember-cli": { command: 'ember', args: ['s', '--proxy', 'http://localhost:3000', '-p']},
  "rails": { command: 'rails', args: ['s', '-p']}
};

function resolve (fn) {
  fn.when(
    function(data) {
      if (data) console.log(data);
      haproxy.close();
    },
    function(error) {
      console.log(error);
      aproxy.close();
    });
}

function findUnusedPort() {
  for (var p = MINPORT; p < MAXPORT; p++) {
    if (serverStatus.ports.index(p) === -1) return p;
  }
  console.log('Error: no available port');
  return null;
}

function createHaproxyRule(backend) {
  return {
    "type": "header"
    , "header": "host"            // the name of the HTTP header
    , "operation": "hdr_dom"
    , "value": backend + domain
    , "backend": backend // if rule is met, the backend to route the request to
    };
}

function createFrontend(bind, backends) {
  return ['www', {
    "bind": bind // IP and ports to bind to, comma separated, host may be *
    , "backend": backends[0] || 'foo'      // the default backend to route to, it must be defined already 
    , "rules": backends.map(function(backend) {
      return createHaproxyRule(backend);
    })
    // , "mode": "http"         // default: http, expects tcp|http
    // , "keepalive": "default"  // default: "default", expects default|close|server-close

  }];
}

function createBackend(id, port, pid) {
  return [id, {
    // "type" : "static" 
    // , "name" : backend
    // , "host" : backend + domain
     "members" : [{ host: '127.0.0.1', port: port, meta: { pid: pid }}]
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

function startServer(repo, branch, demoJson) {
  var vow = VOW.make();
  var status = repos[repo][branch];
  var branchPath = Path.join(REPOS, repo, 'branches', branch);
  var startCommand = demoJson.start.replace('PORT', findUnusedPort());
  if (!demoJson) return VOW.broken('Could not find demo.json, so don\'t know how to start the server..');
  if (status.pid && status.restartOnCheckout) {
    exec('kill ' + status.pid).when(
      function(result) {
        vow.keep(startProcess(branchPath, startCommand));
      },
      function(error) {
        console.log('Error:', error);
        vow.keep(startProcess(branchPath, startCommand));
      });
  }
  if (!status.pid)
    return VOW.kept(startProcess(branchPath, startCommand));
  else return VOW.kept('Server already running');
  return vow.promise;
}

function exec(command) {
  var vow = VOW.make();
  shell.exec(command, function(status, output) {
    if (status !==0) vow.break(status);
    else vow.keep(output);
  });
  return vow.promise;
}

function getPid(path) {
  try {
    var pid = fs.readFileSync(path);
    return pid;
  } catch(e) {
    return null;
  }
}

function getJson(path) {
  try {
    return fs.readJsonSync(path);
  } catch(e) {
    return null;
  };
}

function getDemoJson(repo, branch) {
  var json;
  var repoJsonPath = Path.join(REPOS, repo, 'demo.json');
  var branchJson = getJson(Path.join(REPOS, repo, 'branches', branch, 'demo.json'));
  var repoJson = getJson(repoJsonPath);
  json = branchJson || repoJson;
  if (!repoJson && branchJson) {
    try {
      fs.writeJson(repoJsonPath, branchJson);
    } catch(e) {
      console.log("ERROR: Unable to write demo.json from branch to repo folder");
    }
  }
  return json;
}

function checkout(repo, branch) {
  if (!repos[repo]) {
    error(null, 'Can\'t checkout from repo that doesn\'t exist');
    return;
  }
  
  branch = branch.split('/');
  branch = branch[branch.length-1];

  var workTree = Path.join(REPOS, repo, 'branches', branch);
  fs.ensureDirSync(workTree);

  var gitOperation = "git " + '--work-tree=' + workTree +
    " --git-dir=" + Path.join(REPOS, repo, 'bare') + " checkout " +  branch + " -f";

  exec(gitOperation).when(
    function() {
      var demoJson = getDemoJson(repo, branch);
      return startServer(repo, branch, demoJson);
    }).when(
      function(data) {
        console.log('OK', data);
      },
      function(error) {
        console.log('Error', error);
      });
}

function list(repo, branch) {
  console.log('in list', repo, branch);
  haproxy('getBackends').when(
    function(data) {
      console.log(data);
      haproxy.close();
    },
    function(error) {
      console.log('Error');
      haproxy.close();
    });
}

function bind(url) {
  if (!url) {
    error(null, 'Url missing');
    return;
  }
  var backends = [];
  Object.keys(repos).forEach(function(repo) {
    Object.keys(repos[repo]).forEach(function(branch) {
      backends.push(repo + '-' + branch);
    });
  });
  resolve(haproxy('putFrontend', createFrontend(url, backends)));
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

function info(repo, branch) {
  resolve(haproxy('getHaproxyConfig'));
}


function url(repo, branch) {
  // var status = repos[repo][branch];
  // if (status.pid)
  console.log('http://' + repo + '-' + branch + domain);
  

}

function restart(repo, branch) {
  var status = repos[repo][branch];
  exec('kill ' + status.pid).when(
    function(result) {
      vow.keep(startProcess(branchPath, startCommand));
    },
    function(error) {
      console.log('Error:', error);
      vow.keep(startProcess(branchPath, startCommand));
    });
}

function execInBranch(repo, branch, command) {
  var branchPath = Path.join(REPOS, repo, 'branches', branch);
  resolve(exec('cd ' + branchPath + ';' + command));
}


function start(repo, branch) {
  var status = repos[repo][branch];
  var branchPath = Path.join(REPOS, repo, 'branches', branch);
  var startCommand = demoJson.start.replace('PORT', findUnusedPort());
  var demoJson = getDemoJson(repo, branch);
  if (status.pid) {
    console.log('Server already running');
    return;
  }
  startProcess(branchPath, startCommand);
}

function stop(repo, branch) {
  var status = repos[repo][branch];
    exec('kill ' + status.pid).when(
      function(result) {
        console.log('Killed server');
      },
      function(error) {
        console.log('Error:', error);
      });
}

function log(repo, branch) {

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

  if (!repos[repo][branch] && operation !== 'checkout') {
    error(args, 'Unknown branch');
    return;
  }

  operation = operations.internal.branches[operation];
  if (!operation) {
    error(args, 'Unknown operation for branch');
    return;
  }
  operation(repo, branch);
}

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
  "info <repo> <branch>         : status and url for repo-branch",
  "log <repo> <branch>          : print log of server in branch",
  "exec <repo> <branch>         : execute command in branch folder",
  "bind url                     : domain:port of frontend",
  "\nTo add a remote to a repo:",
  "git remote add demo user@demo.com:repos/myrepo/bare"
];


function error(args, msg) {
  if (msg) console.log(msg);
  else console.log(txt.join('\n'));
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
    bind: function(args) {
      bind(args[0]);
    },
    info: info
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
      delete: deleteBranch,
      start: start,
      stop: stop,
      restart: restart,
      online: online,
      offline: offline,
      log: log,
      exec: execInBranch,
      url: url
    }
  }
};

module.exports = function(operation, args) {
  utils.getServerStatus(REPOS, MINPORT, MAXPORT).when(
    function(data) {
      repos = data.repos;
      serverStatus = data;
      console.log(util.inspect(data, { depth: 10, colors: true }));
      operation = operations.public[operation] || error;
      operation(args);
    }
    ,function(error) {
      console.log(error);
    }
  );
};

module.exports('bind', []);


