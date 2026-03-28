/**
 * PM2 process file for shared hosting / bare metal (no Docker).
 *
 * ZERO-DOWNTIME UPDATES:
 *   pnpm build && pm2 reload ecosystem.config.cjs
 *   — "reload" rolls through cluster instances one at a time, so traffic is
 *     always served by at least one live worker. No downtime.
 *
 * First-time start:
 *   pm2 start ecosystem.config.cjs
 *
 * Log rotation:
 *   pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 40M
 */
module.exports = {
  apps: [
    {
      name: "rebooked-app",
      script: "dist/index.js",
      node_args: "--max-old-space-size=512",
      cwd: __dirname,

      // Cluster mode: enables `pm2 reload` for zero-downtime restarts.
      // 2 instances = one stays live while the other reloads.
      instances: 2,
      exec_mode: "cluster",

      autorestart: true,
      max_memory_restart: "600M",

      // Graceful shutdown: PM2 sends SIGINT, waits for listen_timeout,
      // then kills after kill_timeout.
      kill_timeout: 10000,
      listen_timeout: 15000,
      restart_delay: 3000,

      // Tell PM2 the app is ready when it calls process.send('ready')
      wait_ready: true,

      error_file: "./logs/pm2-app-error.log",
      out_file: "./logs/pm2-app-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env: { NODE_ENV: "production" },
    },
    {
      name: "rebooked-worker",
      script: "dist/worker.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "400M",
      // Worker uses SIGUSR2 for graceful reload
      kill_timeout: 10000,
      error_file: "./logs/pm2-worker-error.log",
      out_file: "./logs/pm2-worker-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env: { NODE_ENV: "production" },
    },
  ],
};
