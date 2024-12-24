const http = require('http');

const server = http.createServer((req, res) => {
  res.end('Server2 is up and running');
});

server.listen(7235, () => {
  console.log('Server 2 running on port 7235');
});