# Changelog

All notable changes to the Submit Sentinel project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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