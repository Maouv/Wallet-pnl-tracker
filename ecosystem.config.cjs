module.exports = {
  apps: [
    {
      name: 'wallet-pnl-bot',
      script: 'src/bot.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      max_restarts: 10,
      restart_delay: 5000,
      watch: false,
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
