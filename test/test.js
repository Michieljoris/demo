function messageId() {
  return 'xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx-xxxx'.replace(/[x]/g, function(c) {
return (Math.random()*16|0).toString(16);
  });
  }
console.log(messageId());


var haproxy = require('node-haproxy/src/ipc-client');
var util = require('util');

function createHaproxyRule(backend, host) {  
  return {
    "type": "header"
    , "header": "host"            // the name of the HTTP header
    , "operation": "hdr_dom"
    , "value": host
    , "backend": backend // if rule is met, the backend to route the request to
    };
}

haproxy('putFrontend', ["www", 
                        {
                          "bind": "127.0.0.1:7500" // IP and ports to bind to, comma separated, host may be *
                          , "backend": "bar"      // the default backend to route to, it must be defined already
                          , "mode": "tcp"         // default: http, expects tcp|http
                          , "keepalive": "close"  // default: "default", expects default|close|server-close
                          , "rules": [
                            createHaproxyRule('foo', 'foo.local.me'),
                            createHaproxyRule('bar', 'bar.local.me')
                          ]           // array of rules, see next section
                          , "natives": []         // array of strings of raw config USE SPARINGLY!!
                        }
                       ])
  .when(
    function(result) {
      console.log('updated frontend');
      return haproxy('putBackend', ["foo", 
                             {
                               // "type" : "static" 
                                "name" : "foo" // only required if type = dynamic
                               // , "version" : "1.0.0" // only required if type = dynamic
                               // , "balance" : "roundrobin|source" // defaults to roundrobin
                               , "host" : "foo.local.me"  // default: undefined, if specified request to member will contain this host header
                               // , "health" : {                 // optional health check
                               //   "method": "GET"            // HTTP method
                               //   , "uri": "/checkity-check"   // URI to call
                               //   , "httpVersion": "HTTP/1.1"  // HTTP/1.0 or HTTP/1.1 `host` required if HTTP/1.1
                               //   , "interval": 5000           // period to check, milliseconds
                               // }
                               // , "mode" : "http|tcp" // default: http
                               // , "natives": []  // array of strings of raw config USE SPARINGLY!!
                               , "members" : [{ host: '127.0.0.1', port: 7000 }] // if type = dynamic this is dynamically populated based on role/version subscription
                               // otherwise expects { host: '10.10.10.10', port: 8080}
                             }]);
    })
  .when(
    function(result) {
      console.log('updated backend foo');
      return haproxy('putBackend', ["bar", 
                             {
                               "type" : "static" 
                               , "name" : "bar" // only required if type = dynamic
                               // , "version" : "1.0.0" // only required if type = dynamic
                               // , "balance" : "roundrobin|source" // defaults to roundrobin
                               , "host" : "bar.local.me"  // default: undefined, if specified request to member will contain this host header
                               // , "health" : {                 // optional health check
                               //   "method": "GET"            // HTTP method
                               //   , "uri": "/checkity-check"   // URI to call
                               //   , "httpVersion": "HTTP/1.1"  // HTTP/1.0 or HTTP/1.1 `host` required if HTTP/1.1
                               //   , "interval": 5000           // period to check, milliseconds
                               // }
                               // , "mode" : "http|tcp" // default: http
                               // , "natives": []  // array of strings of raw config USE SPARINGLY!!
                               , "members" : [{ host: '127.0.0.1', port: 7001 }] // if type = dynamic this is dynamically populated based on role/version subscription
                               // otherwise expects { host: '10.10.10.10', port: 8080}
                             }]);
    })
// haproxy('putFrontend', ['www1'])
// haproxy('deleteBackend', ['backend1'])
  .when(
    function(result) {
      console.log('updated backend bar');
      return haproxy('getFrontends', []);
    })
  .when(
    function(result) {
      console.log("Frontends\n", util.inspect(result, {colors:true, depth: 10} ));
      return haproxy('getBackends', []);
    })
  .when(
    function(result) {
      console.log("Backends\n", util.inspect(result, {colors:true, depth: 10} ));
      return haproxy('getHaproxyConfig', []);
    })
  .when(
    function(result) {
      console.log("config\n", result);
      haproxy.close();
    },
    function(error) {
      console.log("Error\n", error);
      haproxy.close();
    }

  );


// haproxy('putFrontend', createFrontend('www', '127.0.0.1:7500', 'foo', ['foo', 'bar']))
//   .when(
//     function(result) {
//       console.log('updated frontend');
//       return haproxy('putBackend', createBackend('foo', '127.0.0.1', 7000, 4566));
//     })
//   .when(
//     function(result) {
//       console.log('updated backend foo');
//       return haproxy('putBackend', createBackend('bar', '127.0.0.1', 7001, 12345));
//     })
//   .when(
//     function(result) {
//       console.log('updated backend bar');
//       return haproxy('getFrontends', []);
//     })
//   .when(
//     function(result) {
//       console.log("Frontends\n", util.inspect(result, {colors:true, depth: 10} ));
//       return haproxy('getBackends', []);
//     })
//   .when(
//     function(result) {
//       console.log("Backends\n", util.inspect(result, {colors:true, depth: 10} ));
//       return haproxy('getHaproxyConfig', []);
//     })
//   .when(
//     function(result) {
//       console.log("config\n", result);
//       haproxy.close();
//     },
//     function(error) {
//       console.log("Error\n", error);
//       haproxy.close();
//     }

//   );
