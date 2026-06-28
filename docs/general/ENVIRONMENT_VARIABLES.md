# Environment Variables Configuration

This document describes all environment variables used in the JomContest application.

## Overview

JomContest uses environment variables for configuration across different environments (development, staging, production). Variables are organized by application (Next.js web app, Expo mobile app, Appwrite functions).

## Next.js Web App (`apps/next`)

### Configuration Files

- `.env.local` - Local development (gitignored)
- `.env.example` - Template for environment variables (committed)
- `.env.production` - Production overrides (optional)

### Required Variables

#### `NEXT_PUBLIC_BASE_URL`

- **Purpose**: Base URL for the application, used in metadata generation and share URLs
- **Type**: Public (accessible in browser)
- **Format**: Full URL with protocol (e.g., `https://jomcontest.com`)
- **Usage**:
  - Open Graph metadata generation
  - Twitter Card metadata
  - Share URL generation (fallback when `window.location.origin` unavailable)
  - Canonical URLs
- **Examples**:
  - Development: `http://localhost:19000`
  - Staging: `https://staging.jomcontest.com`
  - Production: `https://jomcontest.com`

#### `APPWRITE_API_KEY`

- **Purpose**: Server-side API key for Appwrite operations
- **Type**: Private (server-side only)
- **Security**: Never expose in client-side code
- **Usage**:
  - Server-side metadata generation
  - Fetching contest data for OG tags
  - Server-side database queries
- **How to get**: Generate in Appwrite Console → API Keys → Create API Key
- **Permissions needed**: `databases.read`, `storage.read`

### Optional Variables

#### `APPWRITE_ENDPOINT`

- **Purpose**: Appwrite server endpoint
- **Default**: Uses public endpoint from client config
- **Usage**: Server-side Appwrite client initialization
- **Example**: `https://cloud.appwrite.io/v1`

#### `APPWRITE_PROJECT_ID`

- **Purpose**: Appwrite project ID
- **Default**: Uses public project ID from client config
- **Usage**: Server-side Appwrite client initialization
- **Example**: `your-project-id`

#### `CONTESTS_BUCKET_ID`

- **Purpose**: Appwrite Storage bucket ID for contest images
- **Usage**: Constructing image URLs in metadata
- **Example**: `contests`

## Expo Mobile App (`apps/expo`)

### Configuration Files

- `.env` - Environment variables (gitignored)
- `.env.example` - Template (committed)

### Required Variables

#### `EXPO_PUBLIC_APPWRITE_ENDPOINT`

- **Purpose**: Appwrite server endpoint
- **Example**: `https://cloud.appwrite.io/v1`

#### `EXPO_PUBLIC_APPWRITE_PROJECT_ID`

- **Purpose**: Appwrite project ID
- **Example**: `your-project-id`

#### `EXPO_PUBLIC_MEILISEARCH_FUNCTION_ID`

- **Purpose**: Appwrite Function ID for Meilisearch search
- **Example**: `meilisearch-search-function-id`

## Appwrite Functions

### `generate-og-for-contest`

Environment variables configured in Appwrite Console:

#### Auto-configured by Appwrite

- `APPWRITE_ENDPOINT` - Appwrite server endpoint
- `APPWRITE_PROJECT_ID` - Project ID
- `INTERNAL_API_KEY` - Internal API key (auto-generated)

#### Required Configuration

- `ADMIN_TEAM_ID` - Team ID for admin users
- `CONTESTS_BUCKET_ID` - Storage bucket for contest images
- `DATABASE_ID` - Database ID
- `CONTESTS_COLLECTION_ID` - Contests collection ID
- `CONTEST_FILES_COLLECTION_ID` - Contest Files collection ID
- `GENERATE_BLURHASH_AND_TOKEN_FN_ID` - Function ID for blurhash generation

### `meilisearch-search`

- `MEILISEARCH_HOST` - Meilisearch server URL
- `MEILISEARCH_SEARCH_KEY` - Read-only search API key

### `meilisearch-admin`

- `MEILISEARCH_HOST` - Meilisearch server URL
- `MEILISEARCH_ADMIN_KEY` - Admin API key (write access)

## Setup Instructions

### Local Development

1. **Next.js Web App**:

   ```bash
   cd apps/next
   cp .env.example .env.local
   # Edit .env.local with your values
   ```

2. **Expo Mobile App**:

   ```bash
   cd apps/expo
   cp .env.example .env
   # Edit .env with your values
   ```

3. **Start development servers**:
   ```bash
   # From root directory
   yarn web    # Next.js on http://localhost:19000
   yarn native # Expo on http://localhost:19001
   ```

### Production Deployment

#### Vercel (Next.js)

1. Go to Vercel Dashboard → Project → Settings → Environment Variables
2. Add all required variables:
   - `NEXT_PUBLIC_BASE_URL` (e.g., `https://jomcontest.com`)
   - `APPWRITE_API_KEY` (from Appwrite Console)
   - Optional: `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `CONTESTS_BUCKET_ID`
3. Redeploy application

#### Expo EAS (Mobile)

1. Configure in `eas.json`:

   ```json
   {
     "build": {
       "production": {
         "env": {
           "EXPO_PUBLIC_APPWRITE_ENDPOINT": "https://cloud.appwrite.io/v1",
           "EXPO_PUBLIC_APPWRITE_PROJECT_ID": "your-project-id"
         }
       }
     }
   }
   ```

2. Or use EAS Secrets:
   ```bash
   eas secret:create --name EXPO_PUBLIC_APPWRITE_ENDPOINT --value "https://cloud.appwrite.io/v1"
   ```

#### Appwrite Functions

1. Go to Appwrite Console → Functions → [Function Name] → Settings → Environment Variables
2. Add required variables for each function
3. Redeploy function

## Security Best Practices

### Public vs Private Variables

**Public Variables** (accessible in browser):

- Prefix with `NEXT_PUBLIC_` (Next.js) or `EXPO_PUBLIC_` (Expo)
- Safe to expose: endpoints, project IDs, public keys
- Examples: `NEXT_PUBLIC_BASE_URL`, `EXPO_PUBLIC_APPWRITE_PROJECT_ID`

**Private Variables** (server-side only):

- No prefix (Next.js server-side)
- Never expose: API keys, secrets, admin credentials
- Examples: `APPWRITE_API_KEY`, `MEILISEARCH_ADMIN_KEY`

### API Key Permissions

When creating Appwrite API keys:

1. **Principle of Least Privilege**: Grant only necessary permissions
2. **Server-side keys**: Use for metadata generation (read-only)
3. **Admin keys**: Use only in Appwrite Functions (never in client)
4. **Rotate regularly**: Update keys periodically for security

### Environment-Specific Values

Use different values per environment:

- **Development**: `localhost` URLs, test API keys
- **Staging**: Staging URLs, staging API keys
- **Production**: Production URLs, production API keys

## Troubleshooting

### Variable Not Found

**Symptom**: `process.env.VARIABLE_NAME` is `undefined`

**Solutions**:

1. Check variable is defined in `.env.local` (Next.js) or `.env` (Expo)
2. Restart development server after adding variables
3. Verify variable name matches exactly (case-sensitive)
4. For public variables, ensure correct prefix (`NEXT_PUBLIC_` or `EXPO_PUBLIC_`)

### Share URLs Using Wrong Domain

**Symptom**: Share URLs point to `localhost` in production

**Solutions**:

1. Verify `NEXT_PUBLIC_BASE_URL` is set in production environment
2. Check Vercel environment variables are configured
3. Redeploy application after adding variable
4. Clear browser cache and test again

### Metadata Not Showing Images

**Symptom**: Open Graph images not appearing in social media previews

**Solutions**:

1. Verify `APPWRITE_API_KEY` has `storage.read` permission
2. Check `CONTESTS_BUCKET_ID` is correct
3. Ensure OG image exists in Appwrite Storage
4. Test with Facebook Sharing Debugger
5. Verify image URL is publicly accessible

### Function Execution Fails

**Symptom**: Appwrite Function returns error

**Solutions**:

1. Check all required environment variables are set in Appwrite Console
2. Verify variable values are correct (no typos)
3. Review function execution logs in Appwrite Console
4. Test with simple values first
5. Ensure function has necessary permissions

## Validation Checklist

Before deploying to production:

- [ ] All required variables are set
- [ ] Public variables have correct prefix
- [ ] Private variables are not exposed in client code
- [ ] API keys have appropriate permissions
- [ ] URLs use HTTPS (not HTTP)
- [ ] Base URL matches actual domain
- [ ] Function environment variables are configured
- [ ] Test share functionality works
- [ ] Test metadata generation works
- [ ] Verify OG images load correctly

## Related Documentation

- [OG Image Integration](./OG_IMAGE_INTEGRATION.md)
- [OG Implementation Summary](./OG_IMPLEMENTATION_SUMMARY.md)
- [Deployment Guide](./DEPLOYMENT.md) (if exists)
- [Appwrite Setup](./APPWRITE_SETUP.md) (if exists)

## Support

For issues with environment variables:

1. Check this documentation
2. Verify variable names and values
3. Review application logs
4. Test in development first
5. Check Vercel/Appwrite Console settings

## Changelog

### 2025-10-17

- Added `NEXT_PUBLIC_BASE_URL` documentation
- Added Appwrite Function environment variables
- Added security best practices
- Added troubleshooting guide
