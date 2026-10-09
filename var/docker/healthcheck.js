// Container health check for Coolify: exits 0 only when the orchestrator
// (the worker that publishes scheduled posts) answers /health/status with 200.
// That endpoint only answers once the orchestrator has started its Temporal
// workers, so a deploy whose orchestrator never starts is never marked healthy.
// Usage: node /app/var/docker/healthcheck.js [port]
const port = process.argv[2] || process.env.ORCHESTRATOR_PORT || 3002;

fetch(`http://127.0.0.1:${port}/health/status`, {
  signal: AbortSignal.timeout(8000),
})
  .then((res) => process.exit(res.status === 200 ? 0 : 1))
  .catch(() => process.exit(1));
