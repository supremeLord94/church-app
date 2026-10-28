# Deploying Familia Real on your own server (VPS)

This guide puts everything on one Ubuntu server: the website (served by nginx), the API (Node, kept running by systemd) and the database (MongoDB, only reachable from the server itself). It assumes **Ubuntu 22.04 or 24.04** and that you are logged in as **root** (if you use another user, put `sudo` in front of the commands).

> **A correction first:** SSH is only the way you log in to the server. What protects the website (and everyone's passwords) is **HTTPS** (a certificate). nginx will serve the app over HTTPS, and a free certificate from Let's Encrypt covers it. That needs a **domain name** pointing at the server. Without HTTPS, sign-in passwords travel unprotected over the internet, so please don't skip it. A cheap domain, or a free subdomain from a service like DuckDNS, is enough.

Replace these placeholders everywhere: `example.com` (your domain), `you@example.com` (your email), `YOUR_DB_PASSWORD` (a database password you choose; **letters and numbers only**), `SERVER_IP` (the server's address).

Check your system first: `lsb_release -a` (should say Ubuntu 22.04 or 24.04).

## 0. Point your domain at the server

At your domain provider, create an **A record**: `example.com` → `SERVER_IP` (and `www` the same way if you want it). It can take a few minutes. Check from the server: `dig +short example.com` should print the server's IP (install with `apt install -y dnsutils` if `dig` is missing).

## 1. Prepare the server

```bash
apt update && apt upgrade -y
apt install -y unzip curl gnupg ca-certificates ufw nginx certbot python3-certbot-nginx

# Firewall: only SSH and the website. (Allow SSH BEFORE enabling, or you lock yourself out.)
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

If the server has 1 GB of memory or less, add some swap now so the build in step 5 doesn't get killed:

```bash
fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
apt install -y nodejs
node -v    # should print v24.x (any current LTS, 22 or 24, works)
```

## 3. Install MongoDB (on the same server)

These are the official MongoDB 8.0 steps for Ubuntu. For Ubuntu 22.04, replace `noble` with `jammy`.

```bash
curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | gpg -o /usr/share/keyrings/mongodb-server-8.0.gpg --dearmor
echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-8.0.list
apt update && apt install -y mongodb-org
systemctl enable --now mongod
systemctl status mongod --no-pager    # should say "active (running)"
```

Create the app's database user, then turn on password protection:

```bash
mongosh
```
```js
use church
db.createUser({ user: "church_app", pwd: "YOUR_DB_PASSWORD", roles: [ { role: "readWrite", db: "church" } ] })
exit
```
```bash
nano /etc/mongod.conf
```
Find the line `#security:` and change it to exactly:
```yaml
security:
  authorization: enabled
```
Save (Ctrl+O, Enter, Ctrl+X), then `systemctl restart mongod`. By default MongoDB only listens on `127.0.0.1` (the server itself), so it is not reachable from the internet. Leave it that way and don't open port 27017.

## 4. Put the app on the server

On your **laptop** (PowerShell), upload the zip I gave you (not your working folder: it contains `node_modules` and your private `.env`):

```powershell
scp church-app.zip root@SERVER_IP:/tmp/
```

On the **server**:

```bash
# a user with no login that runs the app
adduser --system --group --home /opt/familia-real --shell /usr/sbin/nologin church
unzip -q /tmp/church-app.zip -d /tmp
cp -a /tmp/church-app/. /opt/familia-real/
rm -rf /tmp/church-app
chown -R church:church /opt/familia-real
chmod 755 /opt/familia-real
```

## 5. Configure and build

```bash
cd /opt/familia-real/server
sudo -H -u church cp .env.example .env
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"    # copy this output for JWT_SECRET
nano .env
```

**Database password with symbols?** The password sits inside a web-style address, so characters such as `@ : / ? # % [ ]` must be written in a "safe" form or you get `MongoParseError: Password contains unescaped characters`. Easiest: use a password of letters and numbers only. If yours has symbols, convert it once and use the result in `MONGO_URI` (and in the backup script in step 8):

```bash
node -e "console.log(encodeURIComponent(process.argv[1]))" 'YOUR_DB_PASSWORD'
```

Use single quotes around the password. The database itself keeps the original password; only the text in `.env` changes.

Make `.env` look like this (use your own values):

```
PORT=5000
MONGO_URI=mongodb://church_app:YOUR_DB_PASSWORD@127.0.0.1:27017/church?authSource=church
JWT_SECRET=paste-the-long-random-string-here
CLIENT_ORIGIN=https://example.com
TZ=America/Tijuana
TRUST_PROXY=1
ACTIVITY_RETENTION_DAYS=365
```

Then:

```bash
chmod 600 .env
sudo -H -u church npm install --omit=dev

cd /opt/familia-real/client
sudo -H -u church bash -c 'npm install && npm run build'    # creates client/dist, the website files
```

Create your first admin (it must change its password the first time it signs in):

```bash
cd /opt/familia-real/server && sudo -H -u church npm run create-user -- "Your Name" you@example.com 'AGoodLongPassword1' admin
```

It has to run **inside the `server` folder** (that is where its `.env` and the `create-user` script live). If you run it from anywhere else, such as the `client` folder, you get `Missing script: "create-user"`.

## 6. Keep the API running (systemd)

```bash
cat > /etc/systemd/system/familia-real.service <<'EOF'
[Unit]
Description=Familia Real API
After=network.target mongod.service
Wants=mongod.service

[Service]
Type=simple
User=church
Group=church
WorkingDirectory=/opt/familia-real/server
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/index.js
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now familia-real
systemctl status familia-real --no-pager
curl -s http://127.0.0.1:5000/api/health        # should print {"ok":true}
```

It now starts by itself when the server reboots. Logs: `journalctl -u familia-real -f`.

## 7. nginx and HTTPS

```bash
cat > /etc/nginx/sites-available/familia-real <<'EOF'
server {
    listen 80;
    listen [::]:80;
    server_name example.com www.example.com;

    root /opt/familia-real/client/dist;
    index index.html;

    add_header X-Content-Type-Options nosniff always;
    add_header X-Frame-Options DENY always;
    add_header Referrer-Policy no-referrer always;

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;

    # the API: passed to Node, along with the visitor's real address
    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 60s;
    }

    # the website's own files can be cached for a long time
    location /assets/ {
        expires 30d;
    }

    # every other address gets the app, so /personas and /asistencia work when refreshed
    location / {
        try_files $uri /index.html;
    }
}
EOF

ln -s /etc/nginx/sites-available/familia-real /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# free HTTPS certificate (also sets up the redirect from http to https and automatic renewal)
certbot --nginx -d example.com -d www.example.com --redirect -m you@example.com --agree-tos
certbot renew --dry-run      # confirms automatic renewal works
```

(If you only use `example.com` without `www`, drop the `www` parts.)

Open `https://example.com`, sign in with the admin you created, and choose a new password. Then check:
- **Actividad** shows your real IP address (not `127.0.0.1`).
- Create a test user and try a different role.

## 8. Backups (do this the same day)

A backup on the same disk doesn't help if the server is lost, so there are two parts: a daily dump on the server, and copies kept somewhere else.

```bash
mkdir -p /var/backups/familia-real
cat > /usr/local/bin/backup-familia-real.sh <<'EOF'
#!/bin/bash
set -e
DIR=/var/backups/familia-real
mongodump --uri="mongodb://church_app:YOUR_DB_PASSWORD@127.0.0.1:27017/church?authSource=church" --gzip --archive="$DIR/church-$(date +%F).gz"
find "$DIR" -name 'church-*.gz' -mtime +14 -delete
EOF
chmod 700 /usr/local/bin/backup-familia-real.sh
echo '0 3 * * * root /usr/local/bin/backup-familia-real.sh' > /etc/cron.d/familia-real-backup
/usr/local/bin/backup-familia-real.sh && ls -lh /var/backups/familia-real      # test it once
```

- **Copy backups to your laptop** now and then (from PowerShell): `scp root@SERVER_IP:/var/backups/familia-real/church-2026-10-25.gz .`
- Also turn on **snapshots or backups in your VPS provider's panel** if they offer them.
- **Restore** (this replaces current data): `mongorestore --uri="mongodb://church_app:YOUR_DB_PASSWORD@127.0.0.1:27017/?authSource=church" --gzip --archive=/var/backups/familia-real/church-2026-10-25.gz --drop`

## 9. Updating the app later

Upload the new zip (step 4's `scp`), then on the server:

```bash
unzip -q -o /tmp/church-app.zip -d /tmp
cp -a /tmp/church-app/. /opt/familia-real/ && rm -rf /tmp/church-app
chown -R church:church /opt/familia-real
cd /opt/familia-real/server && sudo -H -u church npm install --omit=dev
cd /opt/familia-real/client && sudo -H -u church bash -c 'npm install && npm run build'
systemctl restart familia-real
```

Your `.env` is not in the zip, so it is never overwritten.

## 10. Keeping the server safe

- **Updates:** `apt install -y unattended-upgrades` installs security updates automatically. Restart the server now and then when it asks.
- **Failed SSH logins:** `apt install -y fail2ban` blocks addresses that keep guessing.
- **SSH keys instead of passwords** (recommended): create a non-root user with sudo, add your public key, test logging in as that user **in a second window**, and only then disable root and password login in `/etc/ssh/sshd_config` (`PermitRootLogin no`, `PasswordAuthentication no`, then `systemctl restart ssh`). If you get this wrong you can lock yourself out, so keep the first window open until the new login works.
- Never open ports 5000 or 27017. Only 22, 80 and 443 should be open (`ufw status`).
- Keep `.env` and the backup script private (`chmod 600` / `700`, as above).

## If something goes wrong

| What you see | What to check |
|---|---|
| `npm error Missing script: "create-user"` | You are not in the `server` folder (the `client` folder has no such script). Run `cd /opt/familia-real/server`, check with `pwd`, and run the command again |
| `MongoParseError: Password contains unescaped characters` | The database password in `MONGO_URI` has symbols. Convert it with the `encodeURIComponent` command in step 5 and put the result in `.env` (and in the backup script) |
| **502 Bad Gateway** in the browser | The API is down. `systemctl status familia-real` and `journalctl -u familia-real -n 50` |
| Log says **JWT_SECRET falta o es muy corto** | Put a random string of 32+ characters in `server/.env`, then `systemctl restart familia-real` |
| Log says **Authentication failed** (MongoDB) | The user, password or `?authSource=church` in `MONGO_URI` is wrong. The password must have letters and numbers only |
| `mongod` won't start, "Illegal instruction" | The server's CPU lacks AVX, which MongoDB 5 and later need. Check with `grep -o -m1 avx /proc/cpuinfo` (no output = no AVX). Choose a different VPS plan, or use MongoDB Atlas |
| Build says "Killed" | Not enough memory. Add swap (step 1) and run the build again |
| Page works on `/` but **404 on refresh** | The `try_files` line is missing in the nginx config |
| Certbot fails | The A record isn't pointing at the server yet, or port 80 is blocked (`ufw status`) |
| Actividad shows `127.0.0.1` for everyone | `TRUST_PROXY=1` missing in `.env`, or the `X-Forwarded-For` line is missing in nginx |
