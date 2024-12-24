const http = require('http');
const { request } = require('http');

const servers = [
  { url: 'http://localhost:2308', healthy: true },
  { url: 'http://localhost:7235', healthy: true },
];
let current = 0;
const healthCheckInterval = 7000; // 7 seconds

// Function to perform health checks
function performHealthChecks() {
  servers.forEach((server) => {
    const req = http.get(server.url, (res) => {
      if (res.statusCode === 200) {
        server.healthy = true; // Mark server as healthy
      } else {
        server.healthy = false; // Mark server as unhealthy
      }
    });

    req.on('error', () => {
      server.healthy = false; // Mark server as unhealthy on error
    });

    req.end();
  });
}

// Start periodic health checks
setInterval(performHealthChecks, healthCheckInterval);

// Load balancer logic
const loadBalancer = http.createServer((req, res) => {
  const healthyServers = servers.filter((server) => server.healthy);

  if (healthyServers.length === 0) {
    res.writeHead(503);
    res.end('No healthy servers available');
    return;
  }

  const target = healthyServers[current].url;
  current = (current + 1) % healthyServers.length; // Round-robin on healthy servers

  const proxy = http.request(target + req.url, { method: req.method, headers: req.headers }, (proxyRes) => {
    res.writeHead(proxyRes.statusCode, proxyRes.headers);
    proxyRes.pipe(res, { end: true });
  });

  req.pipe(proxy, { end: true });

  proxy.on('error', (err) => {
    res.writeHead(500);
    res.end('Error communicating with server: ' + err.message);
  });
});

// Start the load balancer
loadBalancer.listen(3000, () => {
  console.log('Load Balancer running on port 3000');
});
