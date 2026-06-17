#!/usr/bin/env python3
with open('/etc/nginx/sites-enabled/default') as f:
    conf = f.read()

# Add CartRadar API proxy BEFORE RacksRewards API regex
cart_api = (
    '    # CartRadar API (must be before RacksRewards API regex)\n'
    '    location ^~ /api/search {\n'
    '        proxy_pass http://127.0.0.1:8770;\n'
    '        proxy_set_header Host $host;\n'
    '        proxy_set_header X-Real-IP $remote_addr;\n'
    '    }\n'
)

cart = (
    '    # ---- CartRadar grocery comparison ----\n'
    '    location ^~ /cartradar/ {\n'
    '        rewrite ^/cartradar(.*) /$1 break;\n'
    '        proxy_pass http://127.0.0.1:8770;\n'
    '        proxy_set_header Host $host;\n'
    '        proxy_set_header X-Real-IP $remote_addr;\n'
    '    }\n'
    '    location = /cartradar {\n'
    '        return 301 /cartradar/;\n'
    '    }\n'
)

# Insert in correct order: CartRadar API first, then CartRadar frontend, then RacksRewards API
new_conf = conf.replace('    # Backend API', cart_api + cart + '\n    # Backend API')

with open('/tmp/nginx_new.conf', 'w') as f:
    f.write(new_conf)
print('Config written')
