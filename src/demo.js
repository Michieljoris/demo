var VOW = require('dougs_vow');
var haproxy = require('node-haproxy/src/ipc-client');

// haproxy('getFrontends', [], function(error, result) {
//   console.log(error, result);
// });

var sys = require('sys');
var exec2 = require('child_process').exec;
var Path = require('path');

function puts(error, stdout, stderr) { sys.puts(stdout) }

var shell = require('shelljs');

var fs = require('fs-extra');

var REPOS = Path.join(process.env.HOME, 'repos');
fs.ensureDirSync(REPOS);

var POSTRECEIVE = Path.resolve(__dirname, '..',   'scripts', 'post-receive.sh');

var repos = (function() {
  var repos = fs.readdirSync(REPOS);
  var result = {};
  repos.forEach(function(repo) {
    var dirs = fs.readdirSync(Path.join(REPOS, repo));
    var branches = [];
    if (dirs.indexOf('branches') !== -1) 
      branches = fs.readdirSync(Path.join(REPOS, repo, 'branches'));
    result[repo] = branches;
  });
  return result;
}());

 
function exec(operation) {
  var vow = VOW.make();
  shell.exec(operation, function(status, output) {
    if (status !==0) vow.break(status);
    else vow.keep(output);
  });
  return vow.promise;
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
      var pid = fs.readFileSync(Path.join(REPOS, repo, 'pid'));
      if (!pid) start(repo, branch);
      console.log('Done');
    },
    function(error) {
      // console.log('Error');
    });
}

function list(repo, branch) {
  console.log('in list', repo, branch);
  

}

function _delete(repo, branch) { //delete is keyword

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
        fs.writeFileSync(Path.join(repoPath, 'hooks/post-receive'), postReceive);
        console.log('Created repo  ' + repo);
      } catch(e) {
        console.log(e);
      }
    });

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

function _do(args) {
  if (!args || !args.length) {
    error(args, 'Do what?');
    return;
  }
  var repo = args[0];
  var branch = args[2] ? args[1] : null;
  var operation = branch ? args[2] : args[1];
  
  if (!repo) {
    error(args, 'Name of repo missing');
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

  if (!repos[repo]) {
    error(args, 'Unknown repo');
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
  console.log("Usage:");
  //TODO print usage
}

var operations = {
  public: {
    do: _do,
    checkout: function(args) {
      _do(args.concat('checkout'));
    },
    list: function(args) {
      list();
    }
  },
  internal: {
    repos: {
      list: list
    },
    branches: {
      list: list,
      checkout: checkout
    }
  }
};

module.exports = function(operation, args) {
  operation = operations.public[operation] || error;
  operation(args);
};

module.exports('checkout', ['bla','a/b/c/branch']);


