# Notes App

An AI-powered notes application that converts audio recordings into summarized markdown notes using speech-to-text and language models.

## Features

- 🎤 Audio file upload and processing
- 🔄 Automatic conversion to MP3 using FFmpeg
- 📝 Speech-to-text transcription
- 🤖 AI-powered summarization into markdown
- 👥 Multi-user support with Clerk authentication
- 🗄️ MongoDB database storage
- 📁 File-based storage system
- ⏳ Processing queue with progress tracking
- 🐳 Docker containerization

## Tech Stack

- **Frontend**: Next.js 15, React, TypeScript
- **Authentication**: Clerk
- **Database**: MongoDB
- **File Processing**: FFmpeg
- **AI Integration**: OpenAI-compatible APIs
- **Containerization**: Docker & Docker Compose

## Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd notes-app
cp .env.local.example .env.local
```

### 2. Configure Environment

Edit `.env.local` with your Clerk credentials:

```bash
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
CLERK_SECRET_KEY=your_clerk_secret_key
```

### 3. Run with Docker

```bash
docker-compose up --build
```

The app will be available at http://localhost:3000

### 4. Configure API Settings

1. Sign up/sign in to the app
2. Go to Settings
3. Configure your AI API endpoints:
   - **STT API**: For audio transcription
   - **LLM API**: For text summarization
   - **TTS API**: For text-to-speech (optional)

## File Structure

```
./data/{userId}/{noteId}/
├── original.{extension}  # Original uploaded file (deleted after conversion)
├── converted.mp3        # Converted audio file
└── output.md           # Generated markdown notes
```

## API Configuration

The app supports OpenAI-compatible APIs. Configure these in Settings:

### Speech-to-Text (STT)
- Base URL (e.g., `https://api.openai.com/v1`)
- API Key
- Model Name
- Task (transcribe/translate)
- Temperature

### Large Language Model (LLM)
- Base URL
- API Key
- Model Name

### Text-to-Speech (TTS) [Optional]
- Base URL
- API Key
- Model Name
- Voice
- Response Format
- Speed
- Sample Rate

## Processing Flow

1. **Upload**: User uploads audio file
2. **Queue**: File is queued for processing
3. **Convert**: Audio converted to MP3 using FFmpeg
4. **Cleanup**: Original file deleted to save space
5. **Transcribe**: MP3 transcribed using STT API
6. **Summarize**: Text summarized using LLM API
7. **Save**: Markdown notes saved and made available

## Development

### Local Development

```bash
npm install
npm run dev
```

### Docker Development

```bash
docker-compose up --build
```

## Security Features

- User authentication via Clerk
- User-isolated data storage
- API keys stored securely per user
- No database authentication (internal network only)
- File access restricted by user ID

## Supported Audio Formats

- MP3
- WAV
- M4A
- OGG
- FLAC
- And other formats supported by FFmpeg

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test with Docker
5. Submit a pull request

## License

MIT License
