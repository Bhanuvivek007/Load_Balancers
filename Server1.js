const http = require('http');

const server = http.createServer((req, res) => {
  res.end('Hi Server1 is up and running');
});

server.listen(2308, () => {
  console.log('Server 1 running on port 2308');
});