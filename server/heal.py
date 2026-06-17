#!/usr/bin/env python3
"""
Self-healing monitor for EC2 PM2 processes.
Runs via cron every 5 minutes.
Checks: cartradar, rewards-api, and other critical processes.
If process is down, restarts it and logs the event.
"""

import subprocess, json, sys
from datetime import datetime

CRITICAL_PROCESSES = {
    'cartradar': {
        'script': '/home/ubuntu/cartradar/server.py',
        'interpreter': 'python3',
        'port': 8770,
        'env': {'DEMO_MODE': 'true', 'PORT': '8770'},
    },
    'rewards-api': {
        'script': '/home/ubuntu/rewards-backend/backend/server.py',
        'interpreter': 'python3',
        'port': 5000,
    },
}

LOG_FILE = '/home/ubuntu/heal.log'

def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f'[{ts}] {msg}'
    print(line)
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')

def get_pm2_status():
    """Get PM2 process list as dict"""
    try:
        result = subprocess.run(
            ['pm2', 'jlist'],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode != 0:
            return {}
        return {p['name']: p for p in json.loads(result.stdout)}
    except Exception as e:
        log(f'ERROR getting PM2 status: {e}')
        return {}

def check_port(port):
    """Check if a port is responding"""
    import socket
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(3)
        result = s.connect_ex(('127.0.0.1', port))
        s.close()
        return result == 0
    except:
        return False

def restart_process(name, config):
    """Restart a PM2 process"""
    env_args = []
    for k, v in config.get('env', {}).items():
        env_args.extend(['--env', f'{k}={v}'])

    cmd = [
        'pm2', 'restart', name
    ]
    try:
        subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        subprocess.run(['pm2', 'save'], capture_output=True, timeout=10)
        return True
    except Exception as e:
        log(f'ERROR restarting {name}: {e}')
        return False

def start_process(name, config):
    """Start a new PM2 process"""
    cmd = [
        'pm2', 'start', config['script'],
        '--name', name,
        '--interpreter', config.get('interpreter', 'python3'),
    ]
    for k, v in config.get('env', {}).items():
        cmd.extend(['--env', f'{k}={v}'])

    try:
        subprocess.run(cmd, capture_output=True, text=True, timeout=15)
        subprocess.run(['pm2', 'save'], capture_output=True, timeout=10)
        return True
    except Exception as e:
        log(f'ERROR starting {name}: {e}')
        return False

def main():
    log('--- Heal cycle start ---')
    pm2_status = get_pm2_status()

    for name, config in CRITICAL_PROCESSES.items():
        process = pm2_status.get(name, {})

        # Check if process exists and is online
        if process and process.get('pm2_env', {}).get('status') == 'online':
            log(f'{name}: online (pid={process.get("pid")})')
            continue

        # Process is missing or stopped
        if not process:
            log(f'{name}: MISSING — starting...')
            if start_process(name, config):
                log(f'{name}: STARTED')
        elif process.get('pm2_env', {}).get('status') != 'online':
            log(f'{name}: STOPPED (restarts={process.get("pm2_env", {}).get("restart_time", 0)}) — restarting...')
            if restart_process(name, config):
                log(f'{name}: RESTARTED')

        # Port check
        port = config.get('port')
        if port and not check_port(port):
            log(f'{name}: port {port} NOT responding — restarting...')
            restart_process(name, config)

    log('--- Heal cycle end ---')

if __name__ == '__main__':
    main()
