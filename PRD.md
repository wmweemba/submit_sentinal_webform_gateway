Product Requirements Document (PRD)
Project Name: Submit Sentinel (Custom Multi-Tenant Form Gateway)

Developer: William Mweemba

Version: 1.0.0

1. Project Overview
A lightweight, self-hosted Node.js microservice designed to handle form submissions and file attachments for multiple client websites. It acts as a secure bridge between client-side forms and SMTP email providers.

2. Core Objectives
Zero-Cost Scaling: Add unlimited clients without increasing software costs.

Ultra-Low Footprint: Operate under 150MB RAM to fit a 4GB VPS.

Security-First: Prevent spam, DDoS, and malicious file execution.

Multi-Tenancy: Route submissions based on a unique Client ID.

3. Functional Requirements
Endpoint Routing: POST /submit/:clientSlug.

Attachment Handling: Support for common files (PDF, JPG, PNG, DOCX) up to 5MB.

Email Dispatch: Automated formatting of form data into a clean HTML email sent via SMTP.

Success/Error Feedback: JSON responses for AJAX-based frontends.

4. Security & Resilience (The "Sentinel" Layer)
CORS Whitelisting: The server will only accept requests from the specific domains of your clients.

Rate Limiting: IP-based throttling to prevent a single bot from crashing the service.

Payload Limits: Strict 5MB limit on total form size to prevent RAM exhaustion.

File Sanitization: Use multer to rename files with UUIDs and strip dangerous extensions.

Honeypot Support: Hidden field detection to instantly reject bot submissions.

Environment Safety: All SMTP keys and sensitive data stored in .env.

5. Technical Stack
Runtime: Node.js (Alpine Docker Image for size).

Framework: Express.js.

Middleware: Multer (Files), Nodemailer (Email), Helmet (Headers), Express-Rate-Limit.