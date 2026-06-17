#!/usr/bin/env python3
"""
Self-healing monitor for EC2 PM2 processes.
Runs via cron every 5 minutes.
Checks all critical processes and auto-restarts if down.
"""

import subprocess, json, socket, sys
from datetime import datetime

CRITICAL = ['cartradar', 'rewards-api', 'rewards-v2', 'CF_FEED', 'LAGBOT-TG', 'V68']
PORT_CHECKS = {'cartradar': 8770, 'rewards-api': 5000}

LOG_FILE = '/home/ubuntu/heal.log'

def log(msg):
    ts = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    line = f'[{ts}] {msg}'
    print(line)
    with open(LOG_FILE, 'a') as f:
        f.write(line + '\n')

def get_pm2_status():
    try:
        result = subprocess.run(['pm2', 'jlist'], capture_output=True, text=True, timeout=10)
        if result.returncode != 0:
            return {}
        return {p['name']: p for p in json.loads(result.stdout)}
    except:
        return {}

def check_port(port):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(3)
        result = s.connect_ex(('127.0.0.1', port))
        s.close()
        return result == 0
    except:
        return False

def restart(name):
    try:
        subprocess.run(['pm2', 'restart', name], capture_output=True, timeout=15)
        subprocess.run(['pm2', 'save'], capture_output=True, timeout=10)
        return True
    except Exception as e:
        log(f'ERROR restarting {name}: {e}')
        return False

def main():
    log('=== Heal cycle ===')
    pm2 = get_pm2_status()

    for name in CRITICAL:
        p = pm2.get(name, {})
        status = p.get('pm2_env', {}).get('status', 'missing')

        if status == 'online':
            log(f'{name}: online')
        else:
            log(f'{name}: {status} — restarting...')
            if restart(name):
                log(f'{name}: RESTARTED')

        # Port check
        port = PORT_CHECKS.get(name)
        if port and not check_port(port):
            log(f'{name}: port {port} down — restarting...')
            restart(name)

    log('=== Heal done ===')

if __name__ == '__main__':
    main()
