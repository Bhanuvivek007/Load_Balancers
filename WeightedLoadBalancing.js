const http = require('http');

const servers = [
  { url: 'http://localhost:2308', weight: 3, healthy: true, currentWeight: 0 },
  { url: 'http://localhost:7235', weight: 1, healthy: true, currentWeight: 0 },
];
const healthCheckInterval = 7000; // 7 seconds

// Function to perform health checks
function performHealthChecks() {
  servers.forEach((server) => {
    const req = http.get(server.url, (res) => {
      server.healthy = res.statusCode === 200; // Mark server as healthy if status is 200
    });

    req.on('error', () => {
      server.healthy = false; // Mark server as unhealthy on error
    });

    req.end();
  });
}

// Start periodic health checks
setInterval(performHealthChecks, healthCheckInterval);

// Weighted Round-Robin Algorithm
function getNextServer() {
  let totalWeight = 0;
  let selectedServer = null;

  servers.forEach((server) => {
    if (server.healthy) {
      totalWeight += server.weight;
      server.currentWeight += server.weight;

      if (!selectedServer || server.currentWeight > selectedServer.currentWeight) {
        selectedServer = server;
      }
    }
  });

  if (selectedServer) {
    selectedServer.currentWeight -= totalWeight;
  }

  return selectedServer;
}

// Load balancer logic
const loadBalancer = http.createServer((req, res) => {
  const server = getNextServer();

  if (!server) {
    res.writeHead(503);
    res.end('No healthy servers available');
    return;
  }

  const proxy = http.request(server.url + req.url, { method: req.method, headers: req.headers }, (proxyRes) => {
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
