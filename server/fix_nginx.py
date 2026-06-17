c = open('/etc/nginx/sites-enabled/default').read()
old = 'try_files $uri $uri/ /index.html /demo.html =404;'
new = 'try_files $uri $uri.html $uri/ /index.html =404;'
c = c.replace(old, new)
open('/etc/nginx/sites-enabled/default','w').write(c)
print('Fixed: ' + ('YES' if new in open('/etc/nginx/sites-enabled/default').read() else 'NO'))
