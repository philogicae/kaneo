# Environment Setup Guide

This guide will help you set up the Kaneo development environment and troubleshoot common issues.

## Quick Start

1. **Create a `.env` file** in the root of the project with the required environment variables (see the [documentation](https://kaneo.app/docs/core/installation/environment-variables) for the complete list).

2. **Start the development servers**:
   ```bash
   pnpm dev
   ```

This starts both the API (port 1337) and web app (port 5173). Both will automatically reload when you make changes.

> **Tip**: The web app at http://localhost:5173 will automatically connect to the API at http://localhost:1337

## Environment Variables

Kaneo uses a **single `.env` file** in the root of the project for all environment variables. This file is shared by both the API and web services.

### Required Variables

For development, you'll need at minimum:

- `KANEO_CLIENT_URL` - The URL of the web application (e.g., `http://localhost:5173`)
- `KANEO_API_URL` - The URL of the API (e.g., `http://localhost:1337`)
- `AUTH_SECRET` - Secret key for JWT token generation (**must be at least 32 characters long**; use a long, random value in production)
- `DEVICE_AUTH_CLIENT_IDS` - **Optional.** Comma-separated list of allowed device-flow OAuth client IDs. When unset, Kaneo implicitly allows `kaneo-cli` and `kaneo-mcp` by default (no extra configuration for the CLI or MCP). Override only when you need additional trusted clients, for example `kaneo-cli,kaneo-mcp,my-desktop-app`.
- `DATABASE_PATH` - Path to the local libSQL/SQLite database file (`:memory:` supported). Defaults to `./data/kaneo.db` (resolved from the repository root).
- `KANEO_DATA_PATH` - Docker Compose only: host data directory bind-mounted to `/app/data` (default `./data`).

If your app uses a device client ID that is not included in the defaults, set `DEVICE_AUTH_CLIENT_IDS` to the full comma-separated list of allowed IDs (including any defaults you still need), so it includes the client ID your app sends to `/api/auth/device/code`.

### Development-Specific Variables

For local development, the web app also supports:
- `VITE_API_URL` - API URL for development (defaults to `http://localhost:1337` if not set)
- `VITE_APP_URL` - App URL for generating links (optional)

### Optional Variables

Kaneo supports many optional configuration options including:
- `KANEO_INTERNAL_API_URL` - API origin used only for server-side requests from the built-in HTTP MCP endpoint. Defaults to `http://127.0.0.1:1337`; override it only if the API is not reachable there from its own process.
- SSO providers (GitHub OAuth via `GITHUB_OAUTH_CLIENT_ID` / `GITHUB_OAUTH_CLIENT_SECRET`, Google, Discord, Custom OAuth/OIDC)
- GitHub repository integration (GitHub App: `GITHUB_APP_ID`, `GITHUB_PRIVATE_KEY`, `GITHUB_WEBHOOK_SECRET`, optional `GITHUB_APP_NAME`), separate from GitHub SSO
- SMTP or Resend configuration for email
- Access control settings
- CORS configuration
- Private-network notification receivers (`KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS=true` lets ntfy/Gotify/webhook destinations resolve to private addresses; off by default to prevent SSRF)
- Optional TypeSafe/Jev suggestions (`TYPESAFE_API_KEY` enables relevance-ranked search results and priority/label suggestions when creating tasks; see `.env.sample` for the `KANEO_JEV_*` tuning variables)

#### SMTP Configuration

For sending emails (workspace invitations, magic links, etc.), configure these variables:
- `SMTP_HOST` - SMTP server hostname
- `SMTP_PORT` - SMTP server port
- `SMTP_USER` - SMTP username
- `SMTP_PASSWORD` - SMTP password
- `SMTP_FROM` - From email address
- `SMTP_SECURE` - Use TLS (default: `true`, set to `false` to disable)
- `SMTP_REQUIRE_TLS` - Require TLS (default: `false`, set to `true` to require)
- `SMTP_IGNORE_TLS` - Ignore TLS certificate errors (default: `false`, set to `true` for self-signed certificates)

> **Note:** If you're using an SMTP server with a self-signed or invalid TLS certificate, set `SMTP_IGNORE_TLS=true` to bypass certificate validation.

#### Resend

[Resend](https://resend.com) is supported as an alternative transport (no SMTP relay needed):
- `RESEND_API_KEY` - API key from https://resend.com/api-keys
- `RESEND_FROM` - From header, e.g. `Kaneo <noreply@yourdomain.com>` (falls back to `SMTP_FROM` when unset)

When `RESEND_API_KEY` is set, every email (magic link, OTP, password reset, invitations, notifications, trial reminders) goes through Resend's API; an API key wins over SMTP when both are configured. The `/api/config` response exposes `hasEmail` (any transport configured) so clients can decide whether mail can be sent.

When an email transport is configured (Resend or SMTP), sign-in uses email verification codes by default. Set `DISABLE_EMAIL_OTP_SIGN_IN=true` to use email/password sign-in instead (invitation and notification emails still need a transport).

## Common Issues & Troubleshooting

### CORS Errors

**Symptoms:**
- "Failed to fetch" errors in browser console
- Network errors when making API requests
- "Access to fetch at '...' from origin '...' has been blocked by CORS policy"

**Solutions:**

1. **Check URL Configuration:**
   - Ensure `KANEO_API_URL` matches your API server URL
   - Ensure `KANEO_CLIENT_URL` matches your web app URL
   - For development, you can also set `VITE_API_URL` in your `.env` file

2. **Configure CORS Origins:**
   - Add your frontend URL to `CORS_ORIGINS` in your `.env`:
     ```
     CORS_ORIGINS=http://localhost:5173,https://yourdomain.com
     ```
   - For development, you can leave `CORS_ORIGINS` empty to allow all origins
   - **Note:** `CORS_ORIGINS` should match `KANEO_CLIENT_URL` for proper authentication

3. **Check Protocol Consistency:**
   - Ensure both frontend and API use the same protocol (http/https)
   - Don't mix http and https in development

4. **Verify Server Accessibility:**
   - Test if the API is accessible: `curl http://localhost:1337/config`
   - Check if the server is running on the correct port

### Database Connection Issues

Kaneo runs on a **local libSQL/SQLite file** (`@libsql/client`), configured with `DATABASE_PATH`.

**Symptoms:**
- "Database connection failed" errors
- API server won't start

**Solutions:**

1. **Check the path:**
   - Ensure the directory for `DATABASE_PATH` exists and is writable (the API creates it, but the container user needs write access to the mounted volume).
   - For Docker named volumes this is automatic. For a **bind mount**, the host directory must be writable by the container user (uid 1001):
     `chown 1001:1001 /path/on/host`.
2. **Mount a directory, not the file:** mount the data directory (not just `kaneo.db`) so `kaneo.db-wal` and `kaneo.db-shm` can be written next to it.
3. **Backups:** stop the container (or checkpoint) before copying `kaneo.db`, so the WAL is flushed.

### Authentication Issues

**Symptoms:**
- "Authentication failed" errors
- Users can't sign in

**Solutions:**

1. **Check Authentication Configuration:**
   - Ensure `AUTH_SECRET` is set in your `.env` file
   - Use a strong secret in production
   - Verify `KANEO_CLIENT_URL` and `KANEO_API_URL` are correctly configured

2. **Clear Browser Data:**
   - Clear cookies and local storage
   - Try in incognito/private mode

### Network Errors

**Symptoms:**
- "Network error" messages
- API requests timeout

**Solutions:**

1. **Check Server Status:**
   - Verify API server is running
   - Check server logs for errors

2. **Check Firewall/Proxy:**
   - Ensure ports are not blocked
   - Check if proxy settings interfere

3. **Verify URLs:**
   - Check that all URLs are accessible
   - Test with curl or browser

## Development vs Production

### Development
- Use `http://localhost` for both frontend and API
- Leave `CORS_ORIGINS` empty to allow all origins (or set it to match your local URLs)
- Use simple secrets for `AUTH_SECRET` (not for production)
- The web app will use `VITE_API_URL` if set, otherwise defaults to `http://localhost:1337`

### Production
- Use HTTPS for both frontend and API
- Set specific `CORS_ORIGINS` for security (should match `KANEO_CLIENT_URL`)
- Use strong, unique secrets for `AUTH_SECRET`
- Configure proper database credentials
- Ensure `KANEO_CLIENT_URL` and `KANEO_API_URL` are set to your production URLs

## Getting Help

If you're still experiencing issues:

1. Check the browser console for detailed error messages
2. Review the API server logs
3. Verify all environment variables are set correctly
4. Ensure all services (the Kaneo container and your reverse proxy) are running
5. Consult the [official documentation](https://kaneo.app/docs) for detailed guides and troubleshooting

For the most up-to-date information on environment variables and configuration, always refer to the [official documentation](https://kaneo.app/docs/core/installation/environment-variables).
