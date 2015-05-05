var VOW = require('dougs_vow');
var Path = require('path');
var haproxy = require('node-haproxy/src/ipc-client');
var spawn = require('child_process').spawn;
var util = require('util');
var shell = require('shelljs');
var fs = require('fs-extra');
var extend = require('extend');
var utils = require('./utils');
require('colors');

var POSTRECEIVE = Path.resolve(__dirname,  '../scripts', 'post-receive.sh');
var PACKAGEJSON = Path.resolve(__dirname,  '../package.json');

var REPOS = Path.join(process.env.HOME, 'repos');
fs.ensureDirSync(REPOS);

var defaultBind = '*:7500';
var defaultBackend = { key: 'default',  port: 5000 };

var domain, MINPORT, MAXPORT, aliases;

(function () {
  var config = {};
  var path = Path.join(REPOS, 'conf.json');
  try {
    config =  fs.readJsonSync(path);
  } catch(e) {}
  domain = config.domain || '.demo.local';
  MINPORT = config.minPort || 8000;
  MAXPORT = config.maxPort || 9000;
  aliases = config.aliases || {};
})();

var repos;
var serverStatus;
var frontend;
var frontendPort;
var backends;

var debug = function() {
  // console.log.apply(console, arguments);
};

function inspect(arg) {
  return util.inspect(arg, { depth: 10, colors: true });
}

function resolve (fn) {
  fn.when(
    function(data) {
      if (data) {
        if (Array.isArray(data) && !data.length) ;
        else console.log(data);
      }
      else console.log('Done');
      haproxy.close();
    },
    function(error) {
      console.log(error);
      haproxy.close();
    });
}
function findUnusedPort() {
  for (var p = MINPORT; p < MAXPORT; p++) {
    if (serverStatus.ports.indexOf(p) === -1) return p;
  }
  console.log('Error: no available port');
  return null;
}

function createHaproxyRule(repo, branch, value) {

  console.log(repo, branch, value);
  var backend = repo + '-' + branch;
  value = value || backend + domain;
  return {
    "type": "header"
    , "header": "host"            // the name of the HTTP header
    , "operation": "hdr_dom"
    , "value": value
    , "backend": backend // if rule is met, the backend to route the request to
    };
}

// function createFrontend(bind, defaultBackend, rules) {
//   return ['demo', {
//     "bind": bind 
//     , "backend": defaultBackend      // the default backend to route to, it must be defined already 
//     , "rules":rules;
//     // , "mode": "http"         // default: http, expects tcp|http
//     // , "keepalive": "default"  // default: "default", expects default|close|server-close

//   }];
// }

// function createBackend(id, port, pid) {
//   return [id, {
//     // "type" : "static" 
//     // , "name" : backend
//     // , "host" : backend + domain
//      "members" : [{ host: '127.0.0.1', port: port, meta: { pid: pid }}]
//   }];
// }

function startProcess(path, command) {
  var out = fs.openSync(path + '/out.log', 'a');
  var err = fs.openSync(path + '/out.log', 'a');
  command = command.split(' ');
  var c = command[0];
  var args = command.slice(1);
  var child = spawn(c, args, {
    cwd: path,
    detached: true,
    stdio: [ 'ignore', out, err ]
  });
  child.unref();

  console.log("Started server, pid is", child.pid);
  return child.pid;
}

function startServer(repo, branch, port, restartAlways) {
  var demoJson = getDemoJson(repo, branch);
  if (!demoJson)
    return VOW.broken('Could not find demo.json, so don\'t know how to start the server..');
  var vow = VOW.make();
  var status = repos[repo][branch];
  var branchPath = Path.join(REPOS, repo, 'branches', branch);
  var startCommand = demoJson.start.replace('PORT', port);
  if (status && status.pid) {
    if (demoJson.restartOnCheckout || restartAlways) {
      exec('kill ' + status.pid).when(
        function(result) {
          vow.keep(startProcess(branchPath, startCommand));
        },
        function(error) {
          console.log('Error:', error);
          vow.keep(startProcess(branchPath, startCommand));
        });
    }
    else return VOW.kept(status.pid);
  }
  else return VOW.kept(startProcess(branchPath, startCommand));
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

function getJson(path) {
  try {
    return fs.readJsonSync(path);
  } catch(e) {
    if (e.code !== 'ENOENT')
      console.log(path, e);
    return null;
  };
}

function getDemoJson(repo, branch) {
  var repoJsonPath = Path.join(REPOS, repo, 'demo.json');
  var branchJsonPath = Path.join(REPOS, repo, 'branches', branch, 'demo.json');
  var branchJson = getJson(branchJsonPath);
  var repoJson = getJson(repoJsonPath);
  if (branchJson) console.log('Using demo.json from branch');
  if (!branchJson && repoJson) console.log('Using demo.json copied from another branch');
  // if (!branchJson && !repoJson) console.log('Using demo.json from branch');
  var json = branchJson || repoJson;
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
  console.log(gitOperation);
  var pid, port;
  exec(gitOperation)
    .when(function() {
      port = findUnusedPort();
      return startServer(repo, branch, port); })
    .when(
      function(result) {
        pid = result;
        console.log('Pid: ', pid);
        return haproxy('putBackend', [repo + '-' + branch, {
          "members" : [{ host: '127.0.0.1', port: port, meta: { pid: pid } }] 
        }]);
      })
    // .when(
    //   function() {
    //    return _online(repo, branch, pid);
    //   })
    .when(
      function(data) {
        var str = 'http://' + repo + '-' + branch + domain + ':' + frontendPort;
        console.log('Execute demo online ' + repo + ' ' + branch  + 'to visit your branch at: ' + str);
        if (data) console.log(data);
        haproxy.close();
      },
      function(error) {
        console.log('Error', error);
        haproxy.close();
      });
}

function bind(args) {
  var url = args[0];
  var re = /.+:\d+/;
  if (!url || !url.match(re)) {
    error(null, 'Url missing or wrong format');
    return;
  }
  frontend.bind = url;
  resolve(haproxy('putFrontend', ['demo', frontend]));
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
  var pids = Object.keys(repos[repo])
    .filter(function(branch) {
      return branch.pid;
    })
    .map(function(branch) {
      return branch.pid;
    }).join(' ');
  if (pids.length)
    resolve(exec('kill ' + pids));
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
  var status = repos[repo][branch];
  if (status.pid)
    resolve(exec('kill ' + status.pid));
}

function _online(repo, branch, pid) {
  var vow = VOW.make();
  if (!pid) {
    vow.break('Error: Not running');
  }
  else if (findRule(frontend.rules, repo, branch) !== -1) {
    vow.keep('Already online..');
  }
  else {
    frontend.rules = frontend.rules.concat(createHaproxyRule(repo, branch));
    return haproxy('putFrontend', ['demo', frontend]);
  }
  return vow.promise;
}

function _onlineAlias(alias, repo, branch, pid) {
  var vow = VOW.make();
  if (!pid) {
    vow.break('Error: Not running');
  }
  else if (findRuleByValue(frontend.rules, alias + domain) !== -1) {
    vow.keep('Already online..');
  }
  else {
    console.log(repo, branch, alias, domain);
    frontend.rules = frontend.rules.concat(createHaproxyRule(repo, branch, alias + domain));
    console.log(frontend.rules);
    return haproxy('putFrontend', ['demo', frontend]);
  }
  return vow.promise;
}


function online(repo, branch) {
  var status = repos[repo][branch];
  resolve(_online(repo, branch, status.pid));
}

function onlineAlias(alias) {
  var backend = aliases[alias];
  if (!backend) {
    console.log('Alias not found');
    return;
  }
  var status = repos[backend.repo][backend.branch];
  resolve(_onlineAlias(alias, backend.repo, backend.branch, status.pid));
}

function offlineAlias(alias) {
  var backend = aliases[alias];
  if (!backend) {
    console.log('Alias not found');
    return;
  }
  var index = findRuleByValue(frontend.rules, alias + domain);
  var nRules = frontend.rules.length;
  frontend.rules = frontend.rules.filter(function(rule) {
    return rule.value !== alias + domain;
  });
  if (nRules === frontend.rules.length) {
    console.log('Already offline..');
  }
  else {
    resolve(haproxy('putFrontend', ['demo', frontend]));
  }


}

function offline(repo, branch) {
  var status = repos[repo][branch];
  var index = findRule(frontend.rules, repo, branch);
  var nRules = frontend.rules.length;
  frontend.rules = frontend.rules.filter(function(rule) {
    return rule.backend !== repo + '-' + branch;
  });
  if (nRules === frontend.rules.length) {
    console.log('Already offline..');
  }
  else {
    resolve(haproxy('putFrontend', ['demo', frontend]));
  }
}


function info() {
  var index = findBackendByKey(backends, defaultBackend.key);
  var backend = backends[index];
  var defaultPort = backend ? (backend.members ? backend.members[0].port : '?') : '?'; 
  var txt = [
    "Config:",
    "domain: " + domain.slice(1),
    "bind: " + frontend.bind,
    "port range: " + MINPORT + '-' + MAXPORT,
    "default backend: " + (frontend.backend === defaultBackend.key ?
                           "port " + defaultPort : frontend.backend)
  ];
  console.log(txt.join('\n'));

  console.log('Server status:');
  console.log(util.inspect(serverStatus, { depth: 10, colors: true }));

}

function haproxyInfo () {
  console.log('Frontend:', inspect(frontend));
  console.log('Backends:', inspect(backends));
  console.log('Raw haproxy config file::');
  resolve(haproxy('getHaproxyConfig'));
}

function findRule(rules, repo, branch) {
  var index = -1;;
  var key = repo + '-' + branch;
  rules.some(function(rule, i) {
    if (rule.value === key + domain && rule.backend === key) {
      index = i;
      return true;
    };
    return false;
  });
  return index;
}

function findRuleByValue(rules, value) {
  var index = -1;;
  rules.some(function(rule, i) {
    if (rule.value === value) {
      index = i;
      return true;
    };
    return false;
  });
  return index;
}

function urls(repo) {
  var rules = frontend.rules;
  var r = repo ? [repo] : Object.keys(repos);
  r.forEach(function(repo) {
    Object.keys(repos[repo]).forEach(function(branch) {
      var status = repos[repo][branch];
      var str = 'http://' + repo + '-' + branch + domain + (frontendPort ? ':' + frontendPort : '');
      if (!status.pid) console.log(str + ' (Server down)'.red);
      else console.log(str + (findRule(rules, repo, branch) !== -1 ? ' (online)'.green : ' (offline)'.yellow));
    });
  });
  Object.keys(aliases).forEach(function(alias) {
    var r = aliases[alias].repo;
    if (!repo || r === repo) {
      var branch = aliases[alias].branch;;
      var status = repos[r][branch];
        var str = 'http://' + alias + domain + (frontendPort ? ':' + frontendPort : '') +
        ' --> ' + r + '-' + branch;
      if (!status.pid) console.log(str + ' (Server down)'.red);
      else console.log(str + (findRule(rules, r, branch) !== -1 ? ' (online)'.green : ' (offline)'.yellow));
    }
  });
}

function url(repo, branch) {
  var status = repos[repo][branch];
  var str = 'http://' + repo + '-' + branch + domain + (frontendPort ? ':' + frontendPort : '');
  if (!status.pid) console.log(str + ' (Server down)'.red);
  var rules = (frontend && frontend.rules) ? frontend.rules : [];
  console.log(str + (findRule(rules, repo, branch) !== -1 ? ' (online)'.green : ' (offline)'.yellow));
}

function removeAlias(alias) {
  if (aliases[alias]) {
    delete aliases[alias];
    saveConfig();
    console.log('Alias removed');
  }
  else console.log('Alias not defined'); 
  var index = findRuleByValue(frontend.rules, alias + domain);
  if (index > -1) {
    frontend.rules.splice(index, 1); 
    resolve(haproxy('putFrontend', ['demo', frontend]));
  }
}

function printAliases() {
  var txt = Object.keys(aliases).map(function(alias) {
    return alias +  " --> " + aliases[alias].repo + '-' + aliases[alias].branch;;
  }).join('\n');
  if (txt.length) console.log(txt);
  else console.log('No aliases defined');
}

function setAlias(repo, branch, alias) {
  if (alias.indexOf('-') !== -1) {
    console.log('Hyphens are reserved for repo-branch urls');
    return;
  }
  aliases[alias]  = { repo: repo,  branch: branch };
  saveConfig();
  console.log('Alias set');
}

function restart(repo, branch) {
  var port = findUnusedPort();
  startServer(repo, branch, port, 'restartAlways').when(
    function(pid) {}, function(error) { console.log(error); }
  );
}

function execInBranch(repo, branch, command) {
  var branchPath = Path.join(REPOS, repo, 'branches', branch);
  resolve(exec('cd ' + branchPath + ';' + command));
}

function start(repo, branch) {
  var status = repos[repo][branch];
  if (status.pid) {
    console.log('Server already running');
    return;
  }
  var demoJson = getDemoJson(repo, branch);
  if (!demoJson) {
    console.log('Could not find demo.json, so don\'t know how to start the server..');
    return;
  }
  var branchPath = Path.join(REPOS, repo, 'branches', branch);
  var port = findUnusedPort();
  var startCommand = demoJson.start.replace('PORT', port);
  var pid = startProcess(branchPath, startCommand);
  resolve(haproxy('putBackend', [repo + '-' + branch,
                                 { members: [{ host: '127.0.0.1', port: port, meta: { pid: pid }}] }
                                ]));
}

function stop(repo, branch) {
  var status = repos[repo][branch];
  if (!status.pid) {
    console.log('Server is already not running');
    return;
  }
  exec('kill ' + status.pid).when(
    function(result) {
      console.log('Killed server with pid ' + status.pid);
    },
    function(error) {
      console.log('Error:', error);
    });
}

function log(repo, branch) {
  try {
    var branchPath = Path.join(REPOS, repo, 'branches', branch);
    console.log(fs.readFileSync(Path.join(branchPath, 'out.log') ,{ encoding: 'utf8' }));
  } catch(e) {
    console.log('No log found');
  }
}

function _default(repo, branch) {
  var backend;
  if (!branch) {
    var port = Number.parseInt(repo);
    if (isNaN(port)) {
      log(null, "Port has to be a number");
      return;
    }
    backend = { members: [{ host: '127.0.0.1', port: port }] };
    resolve(haproxy('putBackend', [defaultBackend.key,
                                  ]));
  }
  else {
    var index = findBackendByKey(repo + '-' + branch);
    if (index === -1) {
      log(null, "Can't set default backend to non existent branch");
      return;
    }
    frontend.backend = repo + '-' + branch;
    resolve(haproxy('putFrontend', ['demo', frontend]));
  }
}

function version() {
  var packageJson = fs.readJsonSync(PACKAGEJSON);
  console.log(packageJson.version);
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
  operation(repo, branch, args[2]);
}

var txt = [
  "Help:",
  "create repo                : create a bare git repo on the server",
  "delete repo [branch]       : delete repo or just a branch",
  "urls [repo]                : list urls (or just for repo)",
  "url repo branch            : print url for repo-branch",
  "checkout repo branch       : access branch at repo-branch.domain.com",
  "start repo branch          : start web server for branch",
  "stop repo branch           : stop web server for branch",
  "online repo branch         : take web server online for branch",
  "offline repo branch        : take web server offline for branch",
  "log repo branch            : print log of server in branch",
  "exec repo branch           : execute command in branch folder",
  "bind network  :port        : set network:port of frontend proxy [*:8080]",
  "default repo branch|port   : set proxy to repo-branch or port [port 5000]",
  "domain domain              : set frontend wildcard domain [demo.local]",
  "range minPort maxPort      : set available port range [8000-9000]",
  "alias [alias [repo branch]]: list, remove or set alias",
  "info                       : print config and server status",
  "haproxy                    : print haproxy configuration",
  "v or version               : print version",
  "h or help                  : print this help text",
  "\nTo add a remote to a repo:",
  "git remote add demo user@demo.com:repos/myrepo/bare",
  "\nServe app online at myrepo-branch.demo.com:",
  "git push demo branch"
];

function error(args, msg) {
  if (msg) console.log(msg);
  else {
    console.log(txt.join('\n'));
  }
}

var operations = {
  public: {
    create: function(args) {
      create(args[0]);
    },
    urls: function(args) {
      if (!args || !args.length) urls();
      else _do('urls', args);
    },
    default: function(args) {
      if (args && args.length === 1) _default();
      else _do('_default', args);
    },
    alias: function(args) {
      if (!args || !args.length) printAliases();
      else if (args && args.length === 1) removeAlias(args[0]);
      else _do('setAlias', [args[1], args[2], args[0]]);
    },
    online: function(args) {
      console.log(args);
      
      if (args && args.length === 1) onlineAlias(args[0]);
      else _do('online', args);
    },
    offline: function(args) {
      if (args && args.length === 1) offlineAlias(args[0]);
      else _do('offline', args);
    },
    info: info,
    bind: bind,
    haproxy: haproxyInfo,
    checkout: true, url: true, delete: true,
    stop: true, start: true, restart: true,
    exec: true, 
    delete: true, log: true, default: true
  },
  internal: {
    repos: {
      urls: urls,
      create: create,
      delete: deleteRepo
    },
    branches: {
      bind: bind,
      checkout: checkout,
      delete: deleteBranch,
      start: start,
      stop: stop,
      restart: restart,
      online: online,
      offline: offline,
      log: log,
      exec: execInBranch,
      url: url,
      setAlias: setAlias
    }
  }
};

function findBackendByKey(backends, key) {
  var index = -1;
  backends.some(function(backend, i) {
    if (backend.key === key) {
      index = i;
      return true;
    }
    return false;
  });
  return index;
}

function createBackend(key, port, pid) {
  return { key: key,
           obj: {
             "members" : [{ host: '127.0.0.1', port: port, meta: { pid: pid } }] 
           }
         };
}

function syncHaproxy(frontends, backends, repos) {
  var index;
  var frontendsToDelete =  [];
  var backendsToDelete = [];
  var backendsToWrite = [];
  var writeFrontend;
  serverStatus.serversByKey[defaultBackend.key] = { port: defaultBackend.port };
  if (frontends) {
    frontends.some(function(f, i) {
      if (f.key === 'demo') {
        index = i;
        return true;
      }
      return false;
    });
    if (typeof index !== 'undefined') {
      frontend = frontends[index];
      frontends.splice(index, 1);
      frontendsToDelete = frontends.map(function(f) {
        return f.key;
      });
    }
  }
  if (backends) {
    backends.forEach(function(backend) {
      if (!serverStatus.serversByKey[backend.key])
        backendsToDelete.push(backend.key);
    });
  }
  Object.keys(serverStatus.serversByKey).forEach(function(key) {
    var index = findBackendByKey(backends, key);
    if (index !== -1) {
      var pidPort = serverStatus.serversByKey[key];
      var members = backends[index].members;
      if (!members || !members[0] || members[0].port !== pidPort.port)
        backendsToWrite.push(key);
    }
    else {
      backendsToWrite.push(key);
    }
  });
  if (frontend) {
    if (frontend.backend !== defaultBackend.key &&
        !serverStatus.serversByKey[frontend.backend]) {
      frontend.backend = defaultBackend.key;
      writeFrontend = true;
    }
    frontend.rules = frontend.rules ? frontend.rules : [];;
    frontend.rules = frontend.rules
      .filter(function(rule) {
        var isServed = serverStatus.serversByKey[rule.backend];
        if (!isServed) {  writeFrontend = true; return false; }
        else return true;
      })
      .map(function(rule) {
        if (rule.value !== rule.backend + domain) {
          
          if (aliases[r])
          writeFrontend = true;
          rule.value = rule.backend + domain;
        }
        
        return rule;
      });
  }
  else {
    frontend =  { bind: defaultBind, backend: defaultBackend.key, rules: []  };
    writeFrontend = true;
  }

  var ops = { put: {}, delete: {}};
  if (frontendsToDelete.length) ops.delete.frontends = frontendsToDelete;
  if (backendsToDelete.length) ops.delete.backends = backendsToDelete;
  if (writeFrontend) ops.put.frontend = { key: 'demo', obj: frontend };
  if (backendsToWrite.length) ops.put.backends = backendsToWrite.map(function(backend) {
    var b = serverStatus.serversByKey[backend];
    return createBackend(backend, b.port, b.pid);
  });
  debug('Sync\n', inspect(ops));

  var purgedAliases = {};
  var writeConfig;
  Object.keys(aliases).forEach(function(alias) {
    var repo = aliases[alias].repo;
    var branch = aliases[alias].branch;;
    if (repos[repo] && repos[repo][branch]) {
      purgedAliases[alias] = aliases[alias];
      writeConfig = true;
    }
  });
  aliases = purgedAliases;
  if (writeConfig) saveConfig();
  // console.log('Frontends to delete\n', frontendsToDelete);
  // console.log('Backends to delete\n', backendsToDelete);
  // console.log('Backends to write\n', backendsToWrite);
  // console.log('Write frontend', writeFrontend);
  // console.log('frontend\n', frontend);
  if (!Object.keys(ops.put).length && !Object.keys(ops.delete).length)
    return VOW.kept();
  return haproxy('bulkSet', ops);
}

function setPortRange(minPort, maxPort) {
  minPort = Number.parseInt(minPort);
  maxPort = Number.parseInt(maxPort);
  console.log(MINPORT, MAXPORT);
  if (isNaN(minPort) || isNaN(maxPort))
    error(null, 'Please enter numbers');
  if (minPort >= maxPort)
    error(null, 'maxPort should be bigger than minPort');
  else {
    MINPORT = minPort;
    MAXPORT = maxPort;
    saveConfig();
  }
}

function saveConfig() {
  try {
    var path = Path.join(REPOS, 'conf.json');
    fs.writeJsonSync(path, { domain: domain,
                             minPort: MINPORT,
                             maxPort: MAXPORT,
                             aliases: aliases
                           });
  } catch(e) {
    console.log("Couldn't save config!", e);
  }

}

module.exports = function(operation, args) {
  if (!operation) {
    error();
    return;
  }
  switch (operation) {
   case 'v': ;
   case 'version': version(); return;
   case 'h': ;
   case 'help': error(); return;
   case 'range': setPortRange(args[0], args[1]); return;
   case 'domain':
    domain = '.' + args[0];
    saveConfig();
    operation = 'urls'; args = [];
  default: ;
  }
  var frontends;
  utils.getServerStatus(REPOS, MINPORT, MAXPORT).when(
    function(data) {
      serverStatus = data;
      repos = serverStatus.repos;
      debug('Server status:\n', inspect(serverStatus));
      debug('Haproxy:');
      return haproxy('getFrontends'); })
    .when(function(result) {
      frontends = result; 
      debug('Frontends:', inspect(result));
      return haproxy('getBackends'); })
    .when(
      function(result) {
        backends = result;
        debug('Backends:', inspect(backends));
        return syncHaproxy(frontends, backends, repos);
      })
    .when(
      function(data) {
        haproxy.close();
        frontendPort = frontend.bind.split(':')[1];
        var op = operations.public[operation];
        if (op === true) _do(operation, args);
        else if (!op) error(null, 'unknown operation');
        else op(args);
      }
      ,function(error) {
        haproxy.close();
        console.log(error);
      }
    );
};

// module.exports('ind', '127.0.0.1:7700');
// module.exports('urls', ['127.0.0.1:7609']);
// module.exports('bind', ['127.0.0.1:5700']);
// module.exports('offline', ['bla', 'branch']);
// module.exports('offline', ['foo', 'master']);
// module.exports('online', ['foo', 'master']);
// module.exports('checkout', ['foo', 'master']);
// module.exports('info');
// module.exports('haproxy');
// module.exports('alias', ['foo', 'foo-1', 'foo-alias']);
// module.exports('range', ["a0000", "9000"] );


// module.exports('stop', ['foo', 'master']);//, ['127.0.0.1:7609']);



// resolve(haproxy('getBackend', 'default'));
