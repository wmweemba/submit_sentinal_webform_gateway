# Changelog

All notable changes to the Submit Sentinel project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.5] - 2026-06-21

### Fixed
- **Email deliverability (spam folder)**: Diagnosed ManifiPay test emails landing in spam, tagged `***SPAM***` by the recipient's mail filter
  - Added a missing DMARC record for `mynexusgroup.com` (`_dmarc` TXT, `p=none`) — domain previously had SPF and DKIM but no DMARC, the most common cause of spam-foldering per Resend's deliverability docs
  - Added a plain-text MIME part (`formatEmailTextContent`) alongside the existing HTML body — emails were HTML-only with no multipart/alternative text part
  - Added a configurable `SMTP_REPLY_TO` (defaults to the address in `SMTP_FROM`) so emails have a monitored reply path instead of a bare `noreply` address

### Added
- **`SMTP_REPLY_TO` environment variable** (optional) — documented in `.env.example`

## [1.0.4] - 2026-06-21

### Fixed
- **Stale client config in production**: Removed a persistent Coolify volume mounted at `/app/config` that was shadowing the image-baked `clients.json`, causing newly pushed client configs (e.g. `manifipay`) to never take effect despite successful deploys

### Documentation
- Documented the working method for adding a new client in production: edit `config/clients.json` → commit → push → let Coolify rebuild/restart (no persistent volume on `/app/config`)
- Updated Coolify deployment steps to explicitly warn against mounting a persistent volume at `/app/config`

## [1.0.3] - 2026-06-21

### Added
- **New client**: Added `manifipay` client configuration for the ManifiPay loan application form
  - Allowed origins: `https://manifipay.com`, `https://www.manifipay.com`
  - Recipient email: `info@manifipay.com`

### Changed
- **Temporary staging origin**: Added `https://manifipay.nxhub.online` to `manifipay` allowed origins for pre-launch staging tests
  - See `config/clients.json.notes.md` — must be removed before `manifipay.com` goes live

## [1.0.2] - 2026-03-11

### Added
- **New domain support**: Added `https://psq-associates.com` to allowed origins for `pershing-square` client
- **Configurable sender email**: Added `SMTP_FROM` environment variable for flexible email configuration

### Fixed
- **Resend SMTP restriction issue**: Fixed "550 You can only send testing emails to your own email address" error
  - Removed hardcoded `onboarding@resend.dev` from mail options
  - Added configurable `SMTP_FROM` environment variable with fallback
  - Updated `.env.example` and local `.env` with `SMTP_FROM` configuration
  - Set default to use verified domain `mynexusgroup.com` for production emails

### Changed
- **Client configuration updated**: 
  - Updated recipient email for `pershing-square` client to `consult@psq-associates.com`
  - Added `https://psq-associates.com` to allowed origins
- **Documentation improvements**:
  - Updated README.md with `SMTP_FROM` configuration instructions
  - Added important note for Resend SMTP users about domain verification
  - Updated Docker Compose and Coolify deployment examples
- **Code refactoring**:
  - Moved hardcoded email sender to configurable environment variable
  - Improved code maintainability with centralized configuration constants

### Technical Improvements
- **Environment configuration**: Added `SMTP_FROM` support across all configuration files
- **Error handling**: Better handling of Resend SMTP domain verification requirements
- **Deployment guidance**: Clear instructions for Coolify environment variable setup
- **Backward compatibility**: Maintained fallback to `Submit Sentinel <onboarding@resend.dev>` for existing deployments

## [1.0.1] - 2026-03-09

### Fixed
- **Coolify deployment build error**: `npm ci` failing due to missing `package-lock.json`
  - Removed `package-lock.json` from `.gitignore` to enable reproducible builds
  - Updated Dockerfile: Changed `npm ci --only=production` to `npm ci --omit=dev` (correct npm v7+ syntax)
  - Removed deprecated `--experimental-modules` flag from Dockerfile (Node.js 18+ natively supports ES modules)
  
- **SMTP configuration issues**:
  - Created `.env` file with Resend.com SMTP configuration
  - Fixed SMTP connection errors by properly configuring port 465 with SSL/TLS
  - Verified SMTP connection to Resend.com works successfully
  
- **Port conflict issues**:
  - Resolved `EADDRINUSE: address already in use :::3000` errors
  - Added instructions for killing processes using port 3000
  
- **Development environment setup**:
  - Server now starts successfully with proper SMTP configuration
  - Health endpoint (`/health`) responds correctly
  - All security features enabled and functional

### Changed
- **Client configuration**: 
  - Removed dummy example clients (`example-client`, `acme-corp`, `test-site`)
  - Added production client: `pershing-square` with:
    - Allowed origins: `https://pershingsquare.nxhub.online` and `http://localhost:3000`
    - Recipient email: `wmweemba@gmail.com`
    - Display name: `Pershing Square Form Submission`

### Added
- **Development testing capabilities**:
  - Server can now be tested locally with `npm run dev`
  - Form submissions can be sent to `http://localhost:3000/submit/pershing-square`
  - Emails are successfully delivered via Resend.com SMTP

### Technical Improvements
- **Docker build optimization**: Proper dependency management with `package-lock.json`
- **Node.js compatibility**: Removed deprecated flags for cleaner execution
- **Environment management**: Proper `.env` file structure for development and production
- **Error handling**: Improved startup error messages and troubleshooting guidance

## [1.0.0] - 2026-03-08

### Added
- **Initial project release** - Complete multi-tenant form-to-email gateway
- **Core server implementation** (`index.js`) with Express.js framework
- **Multi-tenant architecture** via URL-based routing (`/submit/:clientSlug`)
- **Security middleware** including:
  - Dynamic CORS whitelisting per client configuration
  - IP-based rate limiting (5 requests/minute per IP)
  - Helmet.js security headers with Content-Security-Policy
  - Input sanitization with HTML entity encoding
  - Honeypot field detection for spam prevention
- **File upload handling** with Multer:
  - 5MB file size limit
  - UUID filename generation to prevent execution
  - Safe mimetype filtering (PDF, images, documents)
- **SMTP email integration** via Nodemailer
- **Client configuration system** (`config/clients.json`)
- **Health check endpoint** (`/health`) for monitoring
- **Comprehensive error handling** with appropriate HTTP status codes
- **Docker support** with multi-stage Alpine build
- **Environment configuration** via `.env.example` template
- **Complete documentation** (`README.md`) with:
  - Installation and configuration guides
  - API reference and examples
  - Frontend integration examples
  - Docker deployment instructions
  - Security best practices
- **MIT License** file
- **Package configuration** with all required dependencies

### Technical Details
- **Framework**: Node.js with Express.js
- **Architecture**: Single-endpoint microservice with JSON-based client configuration
- **Resource Target**: <100MB RAM idle on 4GB VPS
- **Code Style**: Modern ES Modules with async/await patterns
- **Security**: Comprehensive multi-layer protection system
- **Deployment**: Dockerized for Coolify and container orchestration

### Files Created
- `index.js` - Main server application (400+ lines)
- `package.json` - Dependencies and npm scripts
- `config/clients.json` - Multi-tenant client configuration
- `Dockerfile` - Multi-stage Docker build
- `.env.example` - Environment variables template
- `README.md` - Comprehensive project documentation
- `LICENSE` - MIT License
- `changelog.md` - This changelog file

### Security Features Implemented
1. **Rate Limiting**: `express-rate-limit` (max 5 requests per minute per IP)
2. **CORS Protection**: Dynamic whitelisting based on client configuration
3. **Security Headers**: Helmet.js for basic header hardening
4. **File Security**: 5MB limit, UUID renaming, safe mimetype restriction
5. **Spam Prevention**: Honeypot hidden field detection
6. **Input Validation**: XSS/injection protection via sanitization
7. **Multi-Tenant Isolation**: Separate configurations per client

### Deployment Ready
- Docker multi-stage build using `node:18-alpine`
- Health check endpoint for container orchestration
- Graceful shutdown handling
- Production-ready logging and error handling
- Environment-based configuration

---

## Versioning Scheme

- **Major version** (1.x.x): Breaking changes to API or configuration
- **Minor version** (x.1.x): New features while maintaining backward compatibility
- **Patch version** (x.x.1): Bug fixes and security updates

## Maintenance

This project follows semantic versioning. All changes will be documented in this file with clear dates and descriptions of what was added, changed, or removed.