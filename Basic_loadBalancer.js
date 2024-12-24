const http = require('http');
const { request } = require('http');

const servers = ['http://localhost:2308', 'http://localhost:7235'];
let current = 0;

const loadBalancer = http.createServer((req, res) => {
  const target = servers[current];
  current = (current + 1) % servers.length; // Round-robin algorithm

  const proxy = http.request(target + req.url, { method: req.method, headers: req.headers }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxy, { end: true });

  proxy.on('error', (err) => {
    res.writeHead(500);
    res.end('Server error: ' + err.message);
  });
});

loadBalancer.listen(3000, () => {
  console.log('Load Balancer running on port 3000');
});
