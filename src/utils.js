var VOW = require('dougs_vow');
var shell = require('shelljs');
var exec2 = require('child_process').exec;
var Path = require('path');
var fs = require('fs-extra');
var util = require('util');
var REPOS;
var repos;

function exec(command) {
  var vow = VOW.make();
  shell.exec(command, { silent: true }, function(status, output) {
    if (status !==0) vow.break(status);
    else vow.keep(output);
  });
  return vow.promise;
}

function parsePort(str) {
  return parseInt(str.split(':')[1]);
}

function parsePid(str) {
  if (!str) return null;
  return str.split(',')[1];
}

function join(repos, cwdList, portPidMapping) {
  var mapping = portPidMapping.map(function(m, i) {
    return m.concat(cwdList[i]);
  });
  var rogues = mapping.filter(function(m) {
    return m[2].indexOf(REPOS + '/') !== 0;
  });
  var ports = portPidMapping.map(function(m) {
    return m[0];
  });

  // console.log('Rogues (rogue server or process changed directory)\n', rogues);
  var servers = mapping
    .filter(function(m) {
    return m[2].indexOf(REPOS + '/') === 0;
    })
    .map(function(m) {
      var path = m[2].slice(REPOS.length + 1).split('/');
      var repo = path[0];
      var branch = path[2];
      return { port: m[0], pid: m[1], repo: repo, branch: branch };
    });
  var serversByKey = {};
  var orphans = servers.filter(function(s) {
    if (repos[s.repo] && repos[s.repo][s.branch]) {
      serversByKey[s.repo + '-' + s.branch] = 
        repos[s.repo][s.branch] = { pid: s.pid, port: s.port };
      return false;
    }
    else return true;
  });
  // console.log('Servers\n', servers);
  // console.log('Repos\n', repos);
  // console.log('Orphans\n', orphans);
  // console.log('By key\n', reposByKey);
  return { repos: repos, serversByKey: serversByKey, orphans: orphans, rogues: rogues, ports: ports };
  
}

function parseSsOutput(data, minPort, maxPort) {
  var lines = data.split('\n');
  lines = lines.slice(1)
    .filter(function(line) {
      return line.length;
    })
    .map(function(line) {
      line = line.split(' ')
        .filter(function(e) {
          return e.length; });
      return [parsePort(line[3]), parsePid(line[5])];
    })
    .filter(function(line) {
      return line[1] && !isNaN(parseInt(line[0]));
    })
    .filter(function(line) {
      return line[0] >= minPort && line[0] <= maxPort;
    });
  
  return lines;
}

function getCwd(portPidMapping) {
  var vow = VOW.make();
  var pids = portPidMapping.map(function(m) {
    return m[1];
  }).join(' ');
  if (!pids.length) return VOW.kept(join(repos, [], portPidMapping));
  exec('pwdx ' + pids).when(
    function(cwdList) {
      cwdList = cwdList.split('\n')
        .filter(function(line) {
          return line.length;
        })
        .map(function(line) {
          try {
            return (line.split(':')[1]).trim();
          } catch(e) { return ''; }
        });
      vow.keep(join(repos, cwdList, portPidMapping));
    },
    function(error) {
      vow.break('Error getting pids', error);
    }
  );
  return vow.promise;
}

function getPortInfo(minPort, maxPort) {
  return exec('ss -tpl4').when(
    function(data) {
      return getCwd(parseSsOutput(data, minPort, maxPort));
    });
}

function init() {
  repos = (function() {
    var repos = fs.readdirSync(REPOS);
    var result = {};
    repos.forEach(function(repo) {
      try {
        var dirs = fs.readdirSync(Path.join(REPOS, repo));
        var branches = [];
        if (dirs.indexOf('branches') !== -1) 
          branches = fs.readdirSync(Path.join(REPOS, repo, 'branches'));
        var branchesObj = {};
        branches.forEach(function(b) {
          branchesObj[b] = {};
        });
        result[repo] = branchesObj;
      } catch (e) {}
    });
    return result;
  }());
}

module.exports = {
  getServerStatus: function(someREPOS, minPort, maxPort) {
    REPOS = someREPOS; 
    init();
    return getPortInfo(minPort, maxPort);
  }
};

//test
// var someREPOS = Path.join(process.env.HOME, 'repos');
// module.exports.getServerStatus(someREPOS, 7000, 7002).when(
//     function(data) {
//       console.log(util.inspect(data, { depth: 10, colors: true }));
//     },
//     function(error) {
//       console.log(error);
//     });

