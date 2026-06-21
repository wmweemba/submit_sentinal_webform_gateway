# Submit Sentinel

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![Docker Ready](https://img.shields.io/badge/docker-ready-blue)](https://www.docker.com/)

A lightweight, secure, multi-tenant form-to-email gateway designed for resource-constrained environments. Submit Sentinel handles form submissions and file attachments for multiple client websites through a single, secure API endpoint.

## 🚀 Overview

Submit Sentinel is a Node.js microservice that acts as a secure bridge between client-side forms and SMTP email providers. Built for a 4GB VPS environment, it operates under 100MB RAM while providing enterprise-grade security features.

### Key Features

- **Multi-Tenant Architecture**: Single endpoint serves unlimited clients via URL-based routing (`/submit/:clientSlug`)
- **Ultra-Low Footprint**: Optimized for resource-constrained environments (<100MB RAM idle)
- **Security-First Design**: Comprehensive protection against spam, DDoS, and malicious attacks
- **File Attachments**: Secure handling of PDFs, images, and documents up to 5MB
- **Production Ready**: Dockerized, health checks, logging, and graceful shutdown

## 🔒 Security Features

| Feature | Implementation | Protection |
|---------|---------------|------------|
| **Rate Limiting** | 5 requests/minute per IP | DDoS & Brute Force |
| **Dynamic CORS** | Whitelisted origins per client | CSRF & Unauthorized Access |
| **Input Sanitization** | HTML entity encoding | XSS & Injection Attacks |
| **File Security** | UUID renaming, mimetype filtering | Malware & Execution Prevention |
| **Honeypot Detection** | Hidden field validation | Spam Bot Protection |
| **Security Headers** | Helmet.js with CSP | Common Web Vulnerabilities |

## 📁 Project Structure

```
submit_sentinal_webform_gateway/
├── config/
│   └── clients.json          # Client configuration (allowed origins, emails)
├── index.js                  # Main server application
├── package.json              # Dependencies and scripts
├── Dockerfile               # Multi-stage Docker build
├── .env.example             # Environment variables template
├── README.md               # This file
└── ...                     # Other project files
```

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ or Docker
- SMTP credentials (Gmail, SendGrid, etc.)

### Installation

1. **Clone and install dependencies:**
   ```bash
   git clone https://github.com/wmweemba/submit_sentinal_webform_gateway.git
   cd submit_sentinal_webform_gateway
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your SMTP credentials
   ```

3. **Configure clients:**
   Edit `config/clients.json` with your client configurations.

4. **Start the server:**
   ```bash
   npm start
   # Server runs on http://localhost:3000
   ```

### Docker Deployment

```bash
# Build the image
docker build -t submit-sentinel:latest .

# Run the container
docker run -d \
  --name submit-sentinel \
  -p 3000:3000 \
  -v $(pwd)/config:/app/config:ro \
  -v submit-sentinel-uploads:/app/uploads \
  -e SMTP_HOST=smtp.gmail.com \
  -e SMTP_PORT=587 \
  -e SMTP_USER=your-email@gmail.com \
  -e SMTP_PASS=your-app-password \
  submit-sentinel:latest
```

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the project root:

```env
# SMTP Configuration (Required)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
SMTP_FROM=Submit Sentinel <your-email@gmail.com>

# Server Configuration (Optional)
PORT=3000
NODE_ENV=production
MAX_FILE_SIZE_MB=5
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=5
UPLOAD_DIR=./uploads
HONEYPOT_FIELD=_honeypot
LOG_LEVEL=info
```

**Important Note for Resend SMTP Users:**
When using Resend SMTP (`smtp.resend.com`), you must:
1. Verify your domain at [resend.com/domains](https://resend.com/domains)
2. Set `SMTP_FROM` to an email address from your verified domain (e.g., `Submit Sentinel <noreply@yourdomain.com>`)
3. Do not use `@resend.dev` addresses for production emails to non-verified recipients

### Email Deliverability (Avoiding the Spam Folder)

Emails sent by Submit Sentinel were initially landing in recipients' spam folders, tagged `***SPAM***` by the recipient's mail filter. This was root-caused and fixed across three layers — DNS, application code, and Resend account settings. If you set this up again on a new domain, all three are required:

#### 1. DNS records (set at your DNS host, not necessarily your registrar)

Your **registrar** (e.g. Namecheap) only controls domain ownership. DNS records are managed wherever the domain's **nameservers** point — check with `dig +short NS yourdomain.com`. For this project, DNS is hosted at Hosting.com (cPanel-style, `*.mysecurecloudhost.com` nameservers), so all records below were added there via the DNS/Zone Editor.

| Record | Host | Type | Value | Set by |
|---|---|---|---|---|
| SPF | `@` | TXT | `v=spf1 ... include:amazonses.com ~all` (merge with existing SPF if one exists — only one SPF record is allowed per domain) | Resend domain verification |
| DKIM | `resend._domainkey` | TXT | (public key provided by Resend) | Resend domain verification |
| DMARC | `_dmarc` | TXT | `v=DMARC1; p=none; rua=mailto:dmarc-reports@yourdomain.com; fo=1` | **Manual — Resend does not add this automatically** |

DMARC is the one most people skip. Resend's own deliverability docs flag a missing DMARC record as the most common cause of spam-foldering. Start with `p=none` (monitor-only, non-disruptive) and verify with:
```bash
dig +short TXT _dmarc.yourdomain.com
```

#### 2. Application code (`index.js`)

- Emails are sent as **multipart/alternative** (both `html` and `text` bodies via `mailOptions.text`/`mailOptions.html`) — HTML-only emails are a deliverability red flag for spam filters.
- `mailOptions.replyTo` is set via the `SMTP_REPLY_TO` env var (defaults to the address in `SMTP_FROM`), so emails have a monitored reply path instead of a bare `noreply` dead end.

No further action needed here unless you change `SMTP_FROM` — just make sure `SMTP_REPLY_TO` (optional) points to a real, monitored mailbox if you don't want replies to default to the `SMTP_FROM` address.

#### 3. Resend dashboard — disable Open/Click tracking

This was the actual root cause for this project, and is **not a DNS or code issue**: Resend's link/open tracking rewrites every link in your HTML email through a `resend-clicks-a.com` redirect domain. That domain was listed on the invaluement `ivmURI` blocklist at the time, which alone added a 12.0 spam score (5.0 was the recipient's threshold) — entirely independent of SPF/DKIM/DMARC, which were already valid.

**Fix:** Resend dashboard → **Domains** → your domain → **Tracking** → turn **both Open tracking and Click tracking off**. Form-notification emails don't need click/open analytics, and disabling tracking removes both this specific blocklist exposure and the general spam-signal risk of injected tracking pixels/rewritten links.

#### Diagnosing future spam issues

If an email lands in spam again, get the raw headers from the recipient's mail client ("View Source" / "Show Original") and look for `X-Spam-Status` / `X-Spam-Report` — these list the exact rule(s) that fired and their point values, which is far more reliable than guessing. That header is what surfaced the `URIBL_IVMURI` / `resend-clicks-a.com` issue above.

### Client Configuration

Edit `config/clients.json` to define your clients:

```json
{
  "example-client": {
    "allowedOrigins": ["https://example.com", "https://www.example.com"],
    "recipientEmail": "contact@example.com",
    "displayName": "Example Client"
  },
  "acme-corp": {
    "allowedOrigins": ["https://acme-corp.com", "https://app.acme-corp.com"],
    "recipientEmail": "support@acmecorp.com",
    "displayName": "Acme Corporation"
  }
}
```

- **clientSlug**: URL identifier for the client
- **allowedOrigins**: Array of domains allowed to submit forms
- **recipientEmail**: Where form submissions will be sent
- **displayName**: Friendly name for email subjects

#### Adding a New Client (Production / Coolify)

`config/clients.json` is read once at process startup (`readFileSync` in `index.js`) and is **not hot-reloaded** — a running server will not see changes until it restarts. The Dockerfile already copies the whole repo (including `config/clients.json`) into the image at build time, so the supported way to add or update a client is:

1. Edit `config/clients.json` in this repo with the new client entry.
2. Commit and push to `main`.
3. Let Coolify's auto-deploy rebuild the image and restart the container — this picks up the new file automatically.
4. Verify via the Coolify service terminal: `cat /app/config/clients.json` should show the new client.

**Do not** attach a persistent volume to `/app/config` in Coolify. A mounted volume at that path shadows the file baked into the image, so the container will keep serving whatever was last written to the volume instead of your git-committed config — pushes will appear to do nothing. (This caused a real incident: a stale persistent volume meant a new client config never took effect despite being pushed to `main`; removing the volume mapping and redeploying fixed it.) Keeping `clients.json` image-baked (no writable mount) also means there's no live-editable path in production to secure — every change is auditable through git history instead of ad hoc server edits.

## 📡 API Reference

### Submit Form Endpoint

```
POST /submit/:clientSlug
```

**Description**: Submit form data with optional file attachments.

**Headers:**
- `Content-Type: multipart/form-data`
- `Origin: https://your-client-domain.com` (must be in allowedOrigins)

**URL Parameters:**
- `clientSlug` (string, required): Client identifier from configuration

**Form Fields:**
- Any form fields (will be included in email)
- `attachments` (file, optional): Up to 5 files (PDF, images, docs)
- `_honeypot` (hidden field, optional): If filled, submission is rejected as spam

**Success Response (200):**
```json
{
  "success": true,
  "message": "Form submitted successfully",
  "messageId": "<message-id@email-provider>",
  "client": "Example Client",
  "timestamp": "2026-03-08T11:30:00.000Z"
}
```

**Error Responses:**
- `400`: Honeypot triggered or validation failed
- `404`: Client not found in configuration
- `413`: File size exceeds limit (5MB)
- `415`: Unsupported file type
- `429`: Rate limit exceeded (5 requests/minute)
- `500`: Server error or SMTP failure

### Health Check Endpoint

```
GET /health
```

**Description**: Monitor server status and resource usage.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2026-03-08T11:30:00.000Z",
  "service": "submit-sentinel",
  "version": "1.0.0",
  "memory": {
    "rss": "45MB",
    "heapTotal": "23MB",
    "heapUsed": "18MB"
  },
  "uptime": "3600 seconds"
}
```

## 🔧 Frontend Integration

### HTML Form Example

```html
<form 
  action="https://your-server.com/submit/example-client" 
  method="POST" 
  enctype="multipart/form-data"
  class="ajax-form"
>
  <!-- Honeypot field (hidden from users) -->
  <input type="text" name="_honeypot" style="display:none" tabindex="-1" autocomplete="off">
  
  <!-- Regular form fields -->
  <input type="text" name="name" placeholder="Your Name" required>
  <input type="email" name="email" placeholder="Email Address" required>
  <textarea name="message" placeholder="Your Message" required></textarea>
  
  <!-- File attachments -->
  <input type="file" name="attachments" multiple accept=".pdf,.jpg,.png,.doc,.docx">
  
  <button type="submit">Send Message</button>
</form>

<!-- JavaScript for AJAX submission -->
<script>
document.querySelector('.ajax-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const formData = new FormData(form);
  
  try {
    const response = await fetch(form.action, {
      method: 'POST',
      body: formData
    });
    
    const data = await response.json();
    
    if (response.ok) {
      alert('Message sent successfully!');
      form.reset();
    } else {
      alert(`Error: ${data.error} - ${data.message}`);
    }
  } catch (error) {
    alert('Network error. Please try again.');
  }
});
</script>
```

## 🐳 Docker & Deployment

### Docker Compose

Create `docker-compose.yml`:

```yaml
version: '3.8'
services:
  submit-sentinel:
    build: .
    ports:
      - "3000:3000"
    volumes:
      - ./config:/app/config:ro
      - submit-sentinel-uploads:/app/uploads
    environment:
      - SMTP_HOST=${SMTP_HOST}
      - SMTP_PORT=${SMTP_PORT}
      - SMTP_USER=${SMTP_USER}
      - SMTP_PASS=${SMTP_PASS}
      - SMTP_FROM=${SMTP_FROM}
      - NODE_ENV=production
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "const http = require('http'); const options = {host: 'localhost', port: 3000, path: '/health', timeout: 2000}; const req = http.request(options, (res) => { process.exit(res.statusCode === 200 ? 0 : 1); }); req.on('error', () => { process.exit(1); }); req.end();"]
      interval: 30s
      timeout: 3s
      retries: 3
      start_period: 5s

volumes:
  submit-sentinel-uploads:
```

### Coolify Deployment

1. Connect your repository to Coolify
2. Add the following environment variables in Coolify:
   - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
3. **Important for Resend SMTP**: Set `SMTP_FROM` to an email from your verified domain (e.g., `Submit Sentinel <noreply@mynexusgroup.com>`)
4. Configure persistent volumes:
   - `/app/uploads` for temporary file storage
   - **Do NOT** add a persistent volume for `/app/config` — `clients.json` is baked into the image from this repo at build time (see [Adding a New Client](#adding-a-new-client-production--coolify)). A volume there overrides the image's file with stale data, so pushed config changes silently stop taking effect.
5. Deploy with the provided Dockerfile

## 🔍 Monitoring & Logging

### Log Output

The server provides detailed logging:

```
🚀 Submit Sentinel v1.0.0
===========================
  
🔒 Security Features Enabled:
• Dynamic CORS per client
• Rate limiting: 5 req/min per IP
• File size limit: 5MB
• Honeypot spam detection
• Input sanitization
  
📧 Email Configuration:
• SMTP Host: smtp.gmail.com
• SMTP Port: 587
  
🌐 Server Information:
• Environment: production
• Port: 3000
• Upload Directory: ./uploads
• Configured Clients: 3
  
📍 Available Clients:
• example-client → Example Client
• acme-corp → Acme Corporation
• test-site → Test Site (Development)
  
✅ Server running at: http://localhost:3000
```

### Health Monitoring

Use the `/health` endpoint for:
- Load balancer health checks
- Resource usage monitoring
- Uptime tracking

## 🛡️ Security Best Practices

### Recommended Configuration

1. **Use Environment Variables**: Never hardcode credentials
2. **Regular Updates**: Keep dependencies updated with `npm audit`
3. **File Permissions**: Ensure upload directory has proper permissions
4. **SSL/TLS**: Always use HTTPS in production
5. **Firewall Rules**: Restrict access to necessary ports only

### Threat Mitigation

| Threat | Mitigation |
|--------|------------|
| **DDoS Attacks** | Rate limiting (5 req/min per IP) |
| **Spam Bots** | Honeypot fields, rate limiting |
| **XSS Attacks** | Input sanitization, CSP headers |
| **File Upload Attacks** | Mimetype validation, UUID renaming |
| **CSRF Attacks** | Dynamic CORS, Origin validation |
| **Information Disclosure** | Security headers, error masking |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development

```bash
# Install dependencies
npm install

# Development with auto-restart
npm run dev

# Check for security vulnerabilities
npm audit
```

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Express.js, Multer, Nodemailer, and Helmet
- Designed for resource-constrained VPS environments
- Inspired by the need for secure, multi-tenant form handling
- Created by William Mweemba

## 📞 Support

For issues, questions, or feature requests:
1. Check the [Issues](https://github.com/wmweemba/submit_sentinal_webform_gateway/issues) page
2. Review the documentation above
3. Ensure your configuration is correct

---

**Submit Sentinel** - Your secure gateway for form submissions across multiple client websites. Lightweight, secure, and production-ready.