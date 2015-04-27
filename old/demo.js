
function stopForeverProcesses(list) {
  function stopProcess(index) {
    return exec('forever stop ' + index);
  }
  if (!list.length) return VOW.kept();
  var index = list.pop();
  return stopProcess(index).when(
    function(result) {
      return stopForeverProcesses(list);
    });
  
}


// fs.outputJsonSync('~/branches.json', { a: 1 });

var branches;
// readBranches()
//   .when(
//     function(packageObject) {
//       branches = packageObject;
//       console.log(branches);
//       branches[workTree] = { port: 5000 };
//       return exec(gitCommand);
//     })
//   // .when(
//   //   function(output) {
//   //     console.log(output);
//   //     console.log('---------');
//   //     return exec('forever list');
//   //   })
//   // .when(
//   //   function(foreverList) {
//   //     var lines = foreverList.split('\n');
//   //     lines = lines.slice(2).map(function(line, i) {
//   //       return line.indexOf(workTree) !== -1 ? i : -1;
//   //     }).filter(function(line) {
//   //       return line !== -1;
//   //     });
//   //     return stopForeverProcesses(lines);
//   //   })
//   .when(
//     function(output) {
//       // console.log(output);
//       console.log('---------');
//       // return exec('cd ' + workTree + '; forever start -a -l ' + workTree + '/log init.sh ' + 4000);
//       return exec('cd ' + workTree + '; forever start -a -l ' + workTree + '/log init.sh ' + 4000);
//       // exec("ls -la", puts);
//       // exec2('cd ' + workTree + '; sh init.sh &' + '', puts);
//       // return VOW.kept();
//     })
//   .when(
//     function(output) {
//       // console.log(output);
//     },
//     function(status) {
//       console.log('Error:', status);
//     });

function readBranches() {
  var vow = VOW.make();
  fs.readJson('~/branches.json', function (err, packageObj) {
    if (!err) vow.keep(packageObj);
    else vow.keep({});
  });
  return vow.promise;
}
