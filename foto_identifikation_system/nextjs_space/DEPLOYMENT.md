# Deployment Guide: Simavi Semantic Image Vision System

This guide provides instructions for deploying the Simavi Semantic Image Vision System to Fly.io with password protection and proper LLM integration.

## Prerequisites

1. **Fly.io Account**: Sign up at [Fly.io](https://fly.io) if you don't have an account
2. **Fly CLI**: Install the Fly.io command-line interface:
   ```bash
   curl -L https://fly.io/install.sh | sh
   ```
3. **API Keys**: Obtain API keys for your preferred LLM provider(s):
   - Hugging Face: Create an account and get an access token
   - OpenAI: Sign up for an API key
4. **AWS S3**: Set up an S3 bucket for image storage
5. **Database**: Have PostgreSQL database credentials ready

## Environment Configuration

1. **Copy the environment file**:
   ```bash
   cd foto_identifikation_system/nextjs_space
   cp .env.example .env
   ```

2. **Configure environment variables**:
   - `DATABASE_URL`: Your PostgreSQL database connection string
   - `HUGGINGFACE_API_KEY`: Your Hugging Face API token (recommended for cost savings)
   - `OPENAI_API_KEY`: Your OpenAI API key (fallback option)
   - `AWS_BUCKET_NAME`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_REGION`: S3 storage credentials
   - `APP_PASSWORD`: Password for application access (should be strong and secure)
   - `NEXTAUTH_SECRET`: Random secret string for authentication

## Deployment Steps

1. **Initialize Fly app** (if not already done by the fly.toml configuration):
   ```bash
   cd foto_identifikation_system/nextjs_space
   fly launch --generate-name
   ```
   Or if you have an existing app:
   ```bash
   fly launch --name your-app-name
   ```

2. **Set environment variables**:
   ```bash
   fly secrets set DATABASE_URL="your_database_url"
   fly secrets set HUGGINGFACE_API_KEY="your_hf_token"
   fly secrets set OPENAI_API_KEY="your_openai_key"
   fly secrets set AWS_ACCESS_KEY_ID="your_aws_access_key"
   fly secrets set AWS_SECRET_ACCESS_KEY="your_aws_secret"
   fly secrets set AWS_BUCKET_NAME="your_bucket_name"
   fly secrets set AWS_REGION="your_aws_region"
   fly secrets set APP_PASSWORD="your_strong_password"
   fly secrets set NEXTAUTH_SECRET="your_random_auth_secret"
   ```

3. **Set up a PostgreSQL database** on Fly.io:
   ```bash
   fly postgres create --name simavi-db
   fly postgres attach simavi-db
   ```

4. **Deploy the application**:
   ```bash
   fly deploy
   ```

5. **Run database migrations** (after first deployment):
   ```bash
   fly ssh console
   # Inside the console, run the Prisma migration commands
   npx prisma migrate deploy
   ```

## Accessing the Application

The application will be deployed with password protection. To access it:

### Using Browser
- Navigate to your Fly.io app URL
- You'll be prompted for a username and password
- For basic auth, use any username and the value of `APP_PASSWORD` as the password

### Using API
- Include an Authorization header in your requests:
  ```
  Authorization: Basic [base64-encoded-credentials]
  ```
- Where credentials are in the format `username:APP_PASSWORD`

## LLM Configuration

The application supports dual LLM providers with auto-fallback:

1. **Primary**: Hugging Face (recommended for cost savings)
   - Uses `Salesforce/blip-image-captioning-large` for image captioning
   - Uses `mistralai/Mistral-7B-Instruct-v0.2` for structured output

2. **Fallback**: OpenAI
   - Uses `gpt-4o-mini` for direct image analysis
   - More accurate but costs apply

If both providers are unavailable, the application will use a development fallback mode.

## Troubleshooting

### Common Issues

1. **Build Failures**: The application uses a Dockerfile that handles the build process. If build fails, check:
   - Environment variables are properly set
   - Dockerfile has proper node version (18+)

2. **Database Connection**: Ensure `DATABASE_URL` is properly set and the database is accessible

3. **API Key Validation**: Verify that your API keys are valid and not the example placeholder values

4. **Memory Issues**: The application has built-in queue management to prevent memory crashes with large batches

### Health Check

The application provides a health check endpoint at `https://your-app.fly.dev/api/health` that returns status information.

## Security Considerations

1. **Password Protection**: The application is protected by basic authentication using the `APP_PASSWORD` environment variable
2. **API Keys**: Store API keys securely using Fly.io secrets
3. **SSL**: Fly.io automatically provides HTTPS for all applications
4. **Data Storage**: Images are stored in S3 with secure access controls

## Scaling

The Fly.io configuration includes:
- Auto-scaling based on traffic
- Proper resource allocation (1 CPU, 1GB RAM)
- Automatic start/stop for cost optimization

## Updating the Application

To deploy updates:
1. Make your changes to the code
2. Run `fly deploy` from the `foto_identifikation_system/nextjs_space` directory

## Support

For issues with the deployment process:
1. Check the Fly.io logs using `fly logs`
2. Verify all environment variables are properly set
3. Ensure your LLM API keys have sufficient quota