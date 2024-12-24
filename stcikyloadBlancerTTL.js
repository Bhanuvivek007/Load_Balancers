const http = require('http');
const crypto = require('crypto');

const servers = [
  { url: 'http://localhost:2308', weight: 3, healthy: true, currentWeight: 0 },
  { url: 'http://localhost:7235', weight: 1, healthy: true, currentWeight: 0 },
];
const clientToServerMap = new Map(); // Map to store client-to-server mapping with timestamps
const healthCheckInterval = 5000; // 5 seconds
const cleanupInterval = 60000; // 1 minute
const ttl = 300000; // 5 minutes in milliseconds

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

// Function to get or assign a server for a client
function getServerForClient(clientId) {
  const now = Date.now();

  if (clientToServerMap.has(clientId)) {
    const { server, timestamp } = clientToServerMap.get(clientId);
    if (server.healthy && now - timestamp <= ttl) {
      // Return the mapped server if it's healthy and not stale
      clientToServerMap.set(clientId, { server, timestamp: now }); // Update timestamp
      return server;
    } else {
      clientToServerMap.delete(clientId); // Remove stale or unhealthy mapping
    }
  }

  // Assign a new server if no mapping exists or the mapped server is unhealthy/stale
  const server = getNextServer();
  if (server) {
    clientToServerMap.set(clientId, { server, timestamp: now });
  }
  return server;
}

// Function to clean up stale entries
function cleanupStaleEntries() {
  const now = Date.now();
  for (const [clientId, { timestamp }] of clientToServerMap.entries()) {
    if (now - timestamp > ttl) {
      clientToServerMap.delete(clientId); // Remove stale entry
    }
  }
}

// Start periodic cleanup of stale entries
setInterval(cleanupStaleEntries, cleanupInterval);

// Load balancer logic
const loadBalancer = http.createServer((req, res) => {
  const clientId = req.headers['x-client-id'] || crypto.randomUUID(); // Use client ID from header or generate one
  res.setHeader('x-client-id', clientId); // Send client ID back to the client

  const server = getServerForClient(clientId);

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
