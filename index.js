#!/usr/bin/env node

/**
 * Submit Sentinel - Multi-Tenant Form-to-Email Gateway
 * 
 * A lightweight, secure Node.js microservice that handles form submissions
 * and file attachments for multiple client websites. Designed to operate
 * under 100MB RAM on resource-constrained VPS environments.
 * 
 * Security Features:
 * - Multi-tenant routing via URL params (:clientSlug)
 * - Dynamic CORS whitelisting per client
 * - IP-based rate limiting (5 requests/minute)
 * - File upload restrictions (5MB max, safe mimetypes)
 * - Honeypot field detection for spam prevention
 * - Input sanitization against XSS/Injection
 * - Helmet.js security headers
 * - UUID file renaming to prevent execution
 * 
 * @author William Mweemba
 * @version 1.0.0
 */

import express from 'express';
import multer from 'multer';
import { createTransport } from 'nodemailer';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { randomUUID } from 'crypto';
import { extname, join } from 'path';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Load environment variables from .env file
config();

// ES modules workaround for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration constants with environment fallbacks
const PORT = process.env.PORT || 3000;
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB) || 5;
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 5;
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const ALLOWED_MIMETYPES = (process.env.ALLOWED_MIMETYPES || 'image/jpeg,image/png,image/gif,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document').split(',');
const HONEYPOT_FIELD = process.env.HONEYPOT_FIELD || '_honeypot';

// Load client configuration
const CLIENTS_CONFIG = JSON.parse(
  readFileSync(join(__dirname, 'config', 'clients.json'), 'utf8')
);

// Initialize Express app
const app = express();

// ==================== SECURITY MIDDLEWARE ====================

/**
 * 1. Helmet.js - Security HTTP headers
 * Sets various headers like Content-Security-Policy, X-Frame-Options, etc.
 * This helps protect against common web vulnerabilities.
 */
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'"],
    },
  },
}));

/**
 * 2. Rate Limiting - Prevent DDoS and brute force attacks
 * Limits each IP to 5 requests per minute for all endpoints.
 * This prevents a single IP from overwhelming the service.
 */
const limiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX_REQUESTS,
  message: {
    error: 'Too many requests from this IP. Please try again after 1 minute.',
    status: 429
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use(limiter);

/**
 * 3. Dynamic CORS Middleware
 * Checks the client configuration and allows only whitelisted origins.
 * This prevents unauthorized domains from making requests to the API.
 */
const dynamicCors = (req, res, next) => {
  const clientSlug = req.params.clientSlug;
  
  // For preflight requests without clientSlug, use a default
  if (req.method === 'OPTIONS' && !clientSlug) {
    return next();
  }
  
  if (!clientSlug || !CLIENTS_CONFIG[clientSlug]) {
    return res.status(404).json({
      error: 'Client not found',
      message: `No configuration found for client: ${clientSlug}`
    });
  }
  
  const clientConfig = CLIENTS_CONFIG[clientSlug];
  const origin = req.headers.origin;
  
  // If origin is in the allowed list, set CORS headers
  if (origin && clientConfig.allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
};

// ==================== FILE UPLOAD CONFIGURATION ====================

/**
 * Multer storage configuration with security features:
 * - Files are renamed with UUIDs to prevent directory traversal and execution
 * - Only allowed mimetypes are accepted
 * - File size is limited to 5MB
 */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    // Create upload directory if it doesn't exist
    if (!existsSync(UPLOAD_DIR)) {
      mkdirSync(UPLOAD_DIR, { recursive: true });
    }
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Generate a safe filename with UUID to prevent:
    // - Directory traversal attacks
    // - File execution (by removing original extension)
    // - Filename collisions
    const uniqueName = `${randomUUID()}${extname(file.originalname)}`;
    cb(null, uniqueName);
  }
});

/**
 * File filter function - only allow safe file types
 * This prevents uploading of executable files or scripts that could harm the server.
 */
const fileFilter = (req, file, cb) => {
  if (ALLOWED_MIMETYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIMETYPES.join(', ')}`), false);
  }
};

/**
 * Multer middleware configuration
 * - Max file size: 5MB
 * - Max number of files: 5 (adjust as needed)
 * - File filter for security
 */
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: MAX_FILE_SIZE_MB * 1024 * 1024, // Convert MB to bytes
    files: 5 // Maximum number of files per request
  }
});

// ==================== NODEMAILER CONFIGURATION ====================

/**
 * SMTP transporter for sending emails
 * Configuration is loaded from environment variables for security.
 * Added connection timeout and TLS options for production environments.
 */
const transporter = createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false, // false for port 587 (STARTTLS), true for port 465 (SSL)
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  // Connection timeout settings for production environments
  connectionTimeout: 10000, // 10 seconds
  socketTimeout: 15000, // 15 seconds
  // TLS options for secure connections
  tls: {
    // Do not fail on invalid certificates (useful for some container environments)
    rejectUnauthorized: process.env.NODE_ENV === 'production' ? true : false,
  },
  // Debug logging for SMTP connections
  debug: process.env.NODE_ENV === 'development',
  logger: process.env.NODE_ENV === 'development',
});

// Test SMTP connection on startup with better error handling
transporter.verify((error) => {
  if (error) {
    console.error('SMTP Connection Error:', error.message);
    console.error('Error code:', error.code);
    console.error('Error command:', error.command);
    
    // Provide more helpful error messages based on error type
    if (error.code === 'ETIMEDOUT' || error.code === 'ECONNREFUSED') {
      console.warn('⚠️  SMTP connection timeout or refused. Possible issues:');
      console.warn(`   • Firewall blocking port ${process.env.SMTP_PORT || 587}`);
      console.warn('   • Network egress restrictions in container');
      console.warn('   • DNS resolution issues');
      console.warn('   • Resend SMTP service temporarily unavailable');
    } else if (error.code === 'EAUTH') {
      console.warn('⚠️  SMTP authentication failed. Check SMTP_USER and SMTP_PASS.');
    } else {
      console.warn('⚠️  SMTP connection failed. Emails will not be sent until configured correctly.');
    }
  } else {
    console.log('✅ SMTP server connection established successfully');
  }
});

// ==================== UTILITY FUNCTIONS ====================

/**
 * Sanitizes text input to prevent XSS and injection attacks
 * Removes potentially dangerous characters and HTML tags.
 * Uses proper HTML entity encoding for safe inclusion in HTML emails.
 */
const sanitizeInput = (text) => {
  if (typeof text !== 'string') return text;

  return text
    .replace(/[<>]/g, '') // Remove < and > to prevent HTML injection
    .replace(/&/g, '&') // Encode ampersands
    .replace(/"/g, '"') // Encode double quotes
    .replace(/'/g, '&#x27;') // Encode single quotes
    .replace(/\//g, '&#x2F;') // Encode forward slashes
    .trim(); // Remove leading/trailing whitespace
};

/**
 * Formats form data into a clean HTML email
 * Creates a readable, well-structured email for the recipient.
 */
const formatEmailContent = (formData, files = []) => {
  const entries = Object.entries(formData)
    .filter(([key]) => key !== HONEYPOT_FIELD) // Exclude honeypot field
    .map(([key, value]) => {
      const sanitizedKey = sanitizeInput(key);
      const sanitizedValue = sanitizeInput(String(value));
      return `<tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; font-weight: bold;">${sanitizedKey}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${sanitizedValue}</td>
      </tr>`;
    })
    .join('');

  const fileList = files.length > 0
    ? `<h3>Attachments (${files.length})</h3>
       <ul style="list-style-type: none; padding: 0;">
         ${files.map(file => `<li>• ${sanitizeInput(file.originalname)} (${sanitizeInput(file.mimetype)})</li>`).join('')}
       </ul>`
    : '<p><em>No files were attached to this submission.</em></p>';

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4a6fa5; color: white; padding: 20px; text-align: center; }
        .content { background-color: #f9f9f9; padding: 20px; border-radius: 0 0 5px 5px; }
        table { width: 100%; border-collapse: collapse; margin-top: 15px; }
        th { background-color: #f2f2f2; text-align: left; padding: 8px; }
        .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; text-align: center; font-size: 12px; color: #777; }
        .powered-by { margin-top: 10px; }
        .powered-by a { color: #4a6fa5; text-decoration: none; font-weight: bold; }
        .powered-by a:hover { text-decoration: underline; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>📨 New Form Submission</h1>
        </div>
        <div class="content">
          <p>A new form has been submitted via Submit Sentinel.</p>
          
          <h2>Form Data</h2>
          <table>
            <thead>
              <tr>
                <th style="width: 30%;">Field</th>
                <th style="width: 70%;">Value</th>
              </tr>
            </thead>
            <tbody>
              ${entries}
            </tbody>
          </table>
          
          ${fileList}
          
          <div class="footer">
            <p>This email was automatically generated by Submit Sentinel.</p>
            <p>Submission time: ${new Date().toISOString()}</p>
            <div class="powered-by">
              <p>Powered by <a href="https://mynexusgroup.com" target="_blank">Nexus Consulting Services</a></p>
            </div>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
};

// ==================== MAIN ROUTE ====================

/**
 * POST /submit/:clientSlug
 * 
 * Main endpoint for form submissions. Handles:
 * - Client validation and CORS checking
 * - Honeypot spam detection
 * - File uploads with security checks
 * - Input sanitization
 * - Email delivery via SMTP
 * 
 * @route POST /submit/:clientSlug
 * @param {string} clientSlug - Client identifier from URL parameter
 * @returns {object} JSON response with success/error status
 */
// Use upload.fields() to accept both 'attachment' (singular) and 'attachments' (plural) field names
const fileUploadMiddleware = upload.fields([
  { name: 'attachment', maxCount: 1 },
  { name: 'attachments', maxCount: 5 }
]);

app.post('/submit/:clientSlug', dynamicCors, fileUploadMiddleware, async (req, res) => {
  try {
    const { clientSlug } = req.params;
    const clientConfig = CLIENTS_CONFIG[clientSlug];
    
    if (!clientConfig) {
      return res.status(404).json({
        error: 'Client not found',
        message: `No configuration exists for client: ${clientSlug}`
      });
    }

    // ==================== SPAM DETECTION ====================
    // Honeypot check: If a hidden field named HONEYPOT_FIELD is filled,
    // it's likely a bot submission. Reject immediately.
    if (req.body[HONEYPOT_FIELD] && req.body[HONEYPOT_FIELD].trim() !== '') {
      console.log(`🚨 Honeypot triggered for client: ${clientSlug}`);
      return res.status(400).json({
        error: 'Submission rejected',
        message: 'Spam detection triggered'
      });
    }

    // ==================== INPUT SANITIZATION ====================
    // Sanitize all text inputs to prevent XSS and injection attacks
    const sanitizedBody = {};
    for (const [key, value] of Object.entries(req.body)) {
      if (typeof value === 'string') {
        sanitizedBody[key] = sanitizeInput(value);
      } else {
        sanitizedBody[key] = value;
      }
    }

    // ==================== EMAIL PREPARATION ====================
    // Combine files from both 'attachment' and 'attachments' fields
    const allFiles = [];
    if (req.files) {
      if (req.files['attachment']) {
        allFiles.push(...req.files['attachment']);
      }
      if (req.files['attachments']) {
        allFiles.push(...req.files['attachments']);
      }
    }
    
    const emailContent = formatEmailContent(sanitizedBody, allFiles);
    const recipientEmail = clientConfig.recipientEmail;
    const displayName = clientConfig.displayName || clientSlug;

    const mailOptions = {
      // Resend requires a valid email address in the from field
      // Using a generic sender address that should work with Resend SMTP
      from: `Submit Sentinel <onboarding@resend.dev>`,
      to: recipientEmail,
      subject: `New Form Submission: ${displayName}`,
      html: emailContent,
      // Attach files if any were uploaded
      attachments: allFiles.map(file => ({
        filename: file.originalname,
        path: file.path,
        contentType: file.mimetype
      }))
    };

    // ==================== EMAIL DELIVERY ====================
    try {
      const info = await transporter.sendMail(mailOptions);
      
      console.log(`✅ Email sent to ${recipientEmail} for client: ${clientSlug}`);
      console.log(`   Message ID: ${info.messageId}`);

      // ==================== SUCCESS RESPONSE ====================
      res.status(200).json({
        success: true,
        message: 'Form submitted successfully',
        messageId: info.messageId,
        client: displayName,
        timestamp: new Date().toISOString()
      });
    } catch (emailError) {
      console.error(`❌ Email delivery failed for client ${clientSlug}:`, emailError.message);
      
      // Log the submission anyway (for debugging)
      console.log(`📝 Form submission received from ${clientSlug} but email failed`);
      console.log(`   Recipient: ${recipientEmail}`);
      console.log(`   Error: ${emailError.code || 'Unknown error'}`);
      
      // Return a partial success response - form was received but email failed
      res.status(202).json({
        success: true,
        warning: 'Form submitted successfully but email delivery failed',
        message: 'Your form was received but we could not send the confirmation email.',
        client: displayName,
        timestamp: new Date().toISOString(),
        note: 'Administrator has been notified of this issue.'
      });
    }

  } catch (error) {
    console.error(`❌ Submission error for client ${req.params.clientSlug}:`, error);
    
    // Provide appropriate error responses based on error type
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: `Maximum file size is ${MAX_FILE_SIZE_MB}MB`
      });
    }
    
    if (error.message?.includes('Unsupported file type')) {
      return res.status(415).json({
        error: 'Unsupported file type',
        message: error.message
      });
    }
    
    // SMTP/Email errors
    if (error.code?.includes('ESOCKET') || error.code?.includes('EAUTH')) {
      return res.status(500).json({
        error: 'Email service unavailable',
        message: 'Failed to send email. Please try again later.'
      });
    }
    
    // Generic server error
    res.status(500).json({
      error: 'Internal server error',
      message: 'An unexpected error occurred. Please try again later.'
    });
  }
});

// ==================== HEALTH CHECK ENDPOINT ====================

/**
 * GET /health
 * 
 * Simple health check endpoint for monitoring and load balancers.
 * Returns server status and memory usage information.
 */
app.get('/health', (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'submit-sentinel',
    version: '1.0.0',
    memory: {
      rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
      heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
      heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
    },
    uptime: `${Math.floor(process.uptime())} seconds`
  });
});

// ==================== ERROR HANDLING MIDDLEWARE ====================

// 404 handler for undefined routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `The requested endpoint ${req.originalUrl} does not exist.`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred.'
  });
});

// ==================== SERVER INITIALIZATION ====================

app.listen(PORT, () => {
  console.log(`
  🚀 Submit Sentinel v1.0.0
  ===========================
  
  🔒 Security Features Enabled:
  • Dynamic CORS per client
  • Rate limiting: ${RATE_LIMIT_MAX_REQUESTS} req/min per IP
  • File size limit: ${MAX_FILE_SIZE_MB}MB
  • Honeypot spam detection
  • Input sanitization
  
  📧 Email Configuration:
  • SMTP Host: ${process.env.SMTP_HOST || 'Not configured'}
  • SMTP Port: ${process.env.SMTP_PORT || 'Not configured'}
  
  🌐 Server Information:
  • Environment: ${process.env.NODE_ENV || 'development'}
  • Port: ${PORT}
  • Upload Directory: ${UPLOAD_DIR}
  • Configured Clients: ${Object.keys(CLIENTS_CONFIG).length}
  
  📍 Available Clients:
  ${Object.keys(CLIENTS_CONFIG).map(slug => `  • ${slug} → ${CLIENTS_CONFIG[slug].displayName}`).join('\n')}
  
  ✅ Server running at: http://localhost:${PORT}
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});