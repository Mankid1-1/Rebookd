module.exports = {
  apps: [
    {
      name: 'rebookd-server',
      script: 'dist/worker.js',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'development',
        PORT: 3000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      // Graceful shutdown configuration
      kill_timeout: 30000,
      listen_timeout: 10000,
      // Restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '1G',
      // Logging
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_file: './logs/combined.log',
      // Health check
      health_check_grace_period: 3000,
      health_check_fatal_exceptions: true,
      health_check_active: true,
      // Docker compatibility
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'dist'],
      // Process management
      wait_ready: true,
      listen_timeout: 10000,
      kill_timeout: 5000,
      // Security
      node_args: '--max-old-space-size=1024'
    }
  ],
  
  deploy: {
    production: {
      user: 'node',
      host: ['localhost'],
      ref: 'origin/main',
      repo: 'git@github.com:username/rebookd.git',
      path: '/var/www/rebookd',
      'pre-deploy-local': '',
      'post-deploy': 'npm install && npm run build && pm2 reload ecosystem.config.js --env production',
      'pre-setup': ''
    }
  }
};
