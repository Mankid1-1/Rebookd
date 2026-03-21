/**
 * PM2 process file for shared hosting / bare metal (no Docker).
 * Usage: pnpm build && pm2 start ecosystem.config.cjs
 * Log rotation: pm2 install pm2-logrotate && pm2 set pm2-logrotate:max_size 40M
 */
module.exports = {
  apps: [
    {
      name: "rebooked-app",
      script: "node",
      args: "dist/index.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      error_file: "./logs/pm2-app-error.log",
      out_file: "./logs/pm2-app-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env: { NODE_ENV: "production" },
    },
    {
      name: "rebooked-worker",
      script: "node",
      args: "dist/worker.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "400M",
      error_file: "./logs/pm2-worker-error.log",
      out_file: "./logs/pm2-worker-out.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      env: { NODE_ENV: "production" },
    },
  ],
};
