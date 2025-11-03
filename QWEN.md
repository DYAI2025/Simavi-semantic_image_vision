# Foto-Identifikations- und Ordnungssystem

## Project Overview

This is a Next.js-based image analysis and organization system that allows users to automatically analyze and rename their photos based on semantic content, location data, and intelligent categorization. The system supports both local uploads and Google Drive integration, with AI-powered image analysis capabilities.

### Key Features
- **AI Image Analysis**: Vision AI analyzes images to identify locations, scenes, and objects
- **EXIF Data Extraction**: GPS coordinates, camera model, and timestamp extraction from image metadata
- **Intelligent Renaming**: Automatic renaming using the scheme [Location]_[Scene]_[Number]
- **Cloud Storage Integration**: S3-based storage for uploaded images
- **Database Management**: Prisma ORM with PostgreSQL for image metadata
- **Google Drive Integration**: OAuth-based Google Drive connection for direct analysis
- **Batch Processing**: Handles multiple images in a single processing session

### Technology Stack
- **Frontend**: Next.js 14 with React, TypeScript
- **Styling**: Tailwind CSS with Radix UI components
- **Backend**: Next.js API routes
- **Database**: PostgreSQL with Prisma ORM
- **Cloud Storage**: AWS S3 for image storage
- **Authentication**: NextAuth.js with Supabase integration
- **AI Services**: Abacus AI for image analysis (Vision AI)
- **Geocoding**: OpenStreetMap Nominatim for location names

### Project Architecture

The project follows a Next.js 13+ App Router structure:

```
foto_identifikation_system/nextjs_space/
├── app/                    # Next.js app router pages
│   ├── api/               # API routes (process-photos, google-drive, etc.)
│   ├── globals.css        # Global styles
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Main application page
├── components/            # React components (upload system, UI elements)
├── lib/                   # Utility functions (types, S3, EXIF utils)
├── hooks/                 # Custom React hooks
├── prisma/                # Database schema and migrations
├── public/                # Static assets
├── package.json           # Dependencies and scripts
└── [...next config files]
```

### Core Functionality

#### 1. Photo Upload System
- Users can upload photos locally or connect Google Drive
- Drag-and-drop upload interface with image previews
- Local file validation and preview generation
- Batch processing of multiple images

#### 2. AI Analysis Process
- Vision AI powered by Abacus AI analyzes images
- Extracts location and scene information from images
- Handles special cases like signs, text, and landmarks
- Generates consistent, German-language categories

#### 3. EXIF Data Processing
- Extracts GPS coordinates, camera model, and timestamps
- Reverse geocoding to find place names using OpenStreetMap
- Geodata integration for location-based categorization

#### 4. File Management
- Automatic file renaming using [Location]_[Scene]_[Number] format
- S3 storage with timestamp prefixes to avoid conflicts
- Database tracking with Prisma models

#### 5. Google Drive Integration
- OAuth-based authentication for individual users
- Direct processing of Google Drive images without download
- Secure file handling and access management

### Key Data Models

#### Photo Model
- `originalName`: Original filename
- `newName`: AI-generated name in [Location]_[Scene]_[Number] format
- `cloudStoragePath`: S3 storage path
- `location`: AI-identified location category
- `scene`: AI-identified scene description
- `sequenceNumber`: Sequential number for the location category
- `latitude/longitude/altitude`: GPS coordinates
- `exifData`: Full EXIF metadata
- `dateTimeTaken`: Photo timestamp
- `cameraModel`: Camera device information

#### CategoryCounter Model
- Tracks sequential numbering for each location category
- Ensures unique numbering within categories

#### UploadBatch Model
- Groups related photo uploads
- Tracks processing status and statistics

### Important Configuration

#### Environment Variables
- `ABACUSAI_API_KEY`: Vision AI API key for image analysis
- `DATABASE_URL`: PostgreSQL connection string (via Supabase)
- `NEXT_PUBLIC_SUPABASE_PROJECT_URL`: Supabase project configuration
- `NEXT_PUBLIC_SUPABASE_ANON_PUBLIC`: Supabase public key
- AWS S3 credentials for file storage

#### Development Conventions
- TypeScript is used throughout the application
- Component-based architecture with reusable UI elements
- API routes follow Next.js standards with streaming responses
- Error handling with proper user feedback
- Responsive design with Tailwind CSS

### Building and Running

#### Installation
```bash
cd foto_identifikation_system/nextjs_space
npm install
```

#### Running in Development
```bash
npm run dev
```

#### Building for Production
```bash
npm run build
npm start
```

#### Database Setup
```bash
# Generate Prisma client
npx prisma generate

# Apply database migrations
npx prisma db push

# Seed database (if needed)
npx prisma db seed
```

### Development Notes

- The application uses streaming responses for long-running processes (photo analysis)
- Vision AI calls are made to Abacus AI's GPT-4.1-mini model
- Geocoding uses OpenStreetMap's Nominatim API for location names
- File uploads include proper cleanup of preview URLs to prevent memory leaks
- The system handles errors gracefully with user notifications
- Google Drive integration provides individual OAuth flows for each user

### API Endpoints

- `POST /api/process-photos`: Process uploaded images with AI analysis
- `GET/POST /api/google-drive/...`: Google Drive integration endpoints
- `GET /api/image-url/...`: Generate signed URLs for image access
- `POST /api/download/...`: Handle image downloads

### Error Handling

The system implements comprehensive error handling:
- Client-side validation and user feedback
- Server-side error catching with appropriate HTTP status codes
- Database logging of processing errors
- Graceful degradation when external services fail

### Testing

The application includes:
- Component-based testing approach
- API route testing for backend functionality
- Integration tests for Google Drive OAuth flow
- Error boundary implementation for robust error handling