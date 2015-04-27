
var shell = require('shelljs');
var exec2 = require('child_process').exec;


var command = "ember";
// nohup node server.js >/dev/null 2>&1 &
// shell.exec(command, function(status, output) {
//   console.log(status, output);
// });

var fs = require('fs'),
     spawn = require('child_process').spawn,
     out = fs.openSync('./out.log', 'a'),
     err = fs.openSync('./out.log', 'a');

var child = spawn("ember", ["s","--proxy", "http://localhost:3000" ], {
// var child = spawn("ls", [], {
   cwd: "/home/michieljoris/src/ember-cli/frontend",
   detached: true,
   stdio: [ 'ignore', out, err ]
 });

child.unref();

console.log("pid", child.pid);
