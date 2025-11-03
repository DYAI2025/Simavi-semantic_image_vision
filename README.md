# Simavi - Semantic Image Vision System

A Next.js-based application for semantic image analysis, automatic renaming, and geodata extraction. The system uses Vision Language Models (VLM) to analyze images and provide intelligent categorization based on location, scene, and content.

## 🚀 Features

- **Semantic Image Analysis**: Uses AI to identify locations, scenes, and objects in images
- **EXIF Data Extraction**: Automatically extracts GPS coordinates, camera model, and timestamps
- **Intelligent File Renaming**: Automatically renames files using the schema [Location]_[Scene]_[Sequential Number]
- **Dual VLM Support**: Primary support for Hugging Face models with OpenAI fallback
- **Google Drive Integration**: OAuth-based connection for direct image processing from Google Drive
- **Batch Processing**: Handles multiple images in a single processing session
- **Sign Priority Detection**: Special handling for signs, with higher priority than general scene recognition

## 🛠️ Tech Stack

- **Frontend**: Next.js 14 with React, TypeScript
- **Styling**: Tailwind CSS with Radix UI components
- **Backend**: Next.js API routes with streaming responses
- **Database**: PostgreSQL with Prisma ORM (via Supabase)
- **Cloud Storage**: AWS S3 for image storage
- **Authentication**: NextAuth.js with Google OAuth
- **AI Services**: Hugging Face (primary) and OpenAI (fallback) for image analysis
- **Geocoding**: OpenStreetMap Nominatim for location names

## 📁 Project Structure

```
foto_identifikation_system/nextjs_space/
├── app/                    # Next.js app router pages and API routes
│   ├── api/               # API routes (process-photos, google-drive, etc.)
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main application page
├── components/            # React components (upload system, UI elements)
├── lib/                   # Utility functions (types, API clients, EXIF utils)
│   ├── vision-api-client.ts  # Multi-provider VLM client (Hugging Face/OpenAI)
│   ├── exif-utils.ts      # EXIF data extraction utilities
│   └── s3.ts              # S3 storage utilities
├── hooks/                 # Custom React hooks
├── prisma/                # Database schema and migrations
└── public/                # Static assets
```

## 🔧 Setup & Installation

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Access to Hugging Face API (for primary VLM) and/or OpenAI API (for fallback)

### Environment Variables

Create a `.env.local` file in the `foto_identifikation_system/nextjs_space/` directory:

```env
# Vision AI APIs (Hugging Face is primary, OpenAI is fallback)
HUGGINGFACE_API_KEY=your_huggingface_api_key
OPENAI_API_KEY=your_openai_api_key

# Database (Supabase)
DATABASE_URL=your_supabase_postgres_url
NEXT_PUBLIC_SUPABASE_PROJECT_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_PUBLIC=your_supabase_anon_key

# S3 Storage
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
S3_BUCKET_NAME=your_bucket_name
S3_REGION=your_s3_region

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=generate_your_secret_here

# Google Drive API (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
```

### Installation Steps

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd Simavi-semantic_image_vision
   ```

2. Install dependencies:
   ```bash
   cd foto_identifikation_system/nextjs_space
   npm install
   ```

3. Setup database:
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. Run the development server:
   ```bash
   npm run dev
   ```

The application will be available at http://localhost:3000

## 🎯 Usage

### Local Image Upload

1. Navigate to the application homepage
2. Select "Lokaler Upload" tab
3. Drag and drop or select images to upload
4. Click "Mit AI benennen" to start the analysis process
5. Review the suggested names and confirm or reject

### Google Drive Integration

1. Select "Google Drive" tab
2. Connect your Google account via OAuth
3. Select images or folders from your Google Drive
4. Process images directly from Google Drive without downloading

## 🔍 Vision AI Implementation

The system uses a multi-provider approach for Vision Language Models:

### Primary: Hugging Face
- Uses `Salesforce/blip-image-captioning-large` for image captioning
- Followed by `mistralai/Mistral-7B-Instruct-v0.2` for structured output
- Free tier available with rate limits

### Fallback: OpenAI
- Uses `gpt-4o-mini` for direct image analysis
- More accurate but costs apply
- Activated when Hugging Face is unavailable

### Sign Detection Priority

The system prioritizes sign detection over general scene recognition:
- If a sign, plaque, or informational board is detected in an image
- The system will categorize it as "Schild" (sign)
- The text content of the sign becomes the scene descriptor
- This ensures important textual information is preserved

## 🧪 Testing

### VLM Connectivity Test
A GitHub Actions workflow is included to test VLM connectivity on every commit:

```bash
# Run the connectivity test locally
node ../../test-vlm-connectivity.js
```

### Image Processing Test
Test the complete image processing pipeline:

```bash
# Run comprehensive image processing test
node ../../test-image-processing.js
```

## 🚀 Deployment

### Environment Setup
For production deployment, ensure all required environment variables are set appropriately.

### Build and Run
```bash
# Build the application
npm run build

# Start the production server
npm start
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Add tests for your changes
5. Run the test suite
6. Commit your changes (`git commit -m 'Add amazing feature'`)
7. Push to the branch (`git push origin feature/amazing-feature`)
8. Open a Pull Request

## 🐛 Troubleshooting

### Common Issues

1. **API Key Errors**: Ensure HUGGINGFACE_API_KEY or OPENAI_API_KEY are properly set
2. **Image Processing Fails**: Check that image files are valid and under size limits
3. **Google Drive Integration**: Verify OAuth credentials and permissions
4. **EXIF Data Missing**: Some images may not contain GPS or camera metadata

### Debugging

Enable detailed logging by setting the appropriate environment variables and checking server logs.

## 🔒 Security

- API keys are stored in environment variables and never committed to the repository
- OAuth flows use secure tokens with proper expiration
- Database connections use encrypted connections
- File uploads are validated and sanitized

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Hugging Face for providing accessible vision models
- OpenAI for advanced vision capabilities
- The Next.js team for the excellent framework
- OpenStreetMap for geocoding services