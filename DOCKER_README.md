# Docker Setup for Confluence Tool

This setup provides both frontend (React) and backend (Node.js) services using Docker Compose.

## Services

- **Backend**: Node.js server running on port 3002
- **Frontend**: React app served by nginx on port 3000 (production) or port 3000 (development)

## Prerequisites

- Docker and Docker Compose installed
- Python 3 (for the backend update script)

## Quick Start

### Production Mode
```bash
# Build and start services
docker-compose up --build

# Or run in background
docker-compose up -d --build
```

### Development Mode
```bash
# Build and start services with hot reloading
docker-compose -f docker-compose.dev.yml up --build
```

## Accessing Services

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3002
- **Health Check**: http://localhost:3002/api/health

## Available Commands

```bash
# Build services
docker-compose build

# Start services
docker-compose up

# Start in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs

# Follow logs for specific service
docker-compose logs -f frontend
docker-compose logs -f backend
```

## Environment Variables

Create a `.env` file in the root directory if needed:

```env
# Backend Configuration
NODE_ENV=production
CONFLUENCE_BASE_URL=https://inside-docupedia.bosch.com/confluence
CONFLUENCE_PAT=your_token_here

# Frontend Configuration
REACT_APP_API_URL=http://localhost:3002
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Make sure ports 3000 and 3002 are not in use
2. **Permission issues**: Ensure Docker has proper permissions
3. **Build failures**: Try cleaning Docker cache: `docker system prune -a`

### Debugging

```bash
# Check container status
docker-compose ps

# Access container shell
docker-compose exec backend sh
docker-compose exec frontend sh

# View container logs
docker-compose logs [service_name]
```

## File Structure

```
├── docker-compose.yml          # Production setup
├── docker-compose.dev.yml      # Development setup
├── backend/
│   ├── Dockerfile             # Backend container definition
│   ├── confluence-server-combined.js
│   └── update_gwm_precise_refactored.py
├── frontend/
│   ├── Dockerfile             # Frontend production container
│   ├── Dockerfile.dev         # Frontend development container
│   ├── nginx.conf             # Nginx configuration
│   └── src/                   # React source code
└── .dockerignore              # Files to exclude from Docker context
```

## Production Deployment

The production setup uses:
- Multi-stage builds for optimized images
- Nginx for serving static files and reverse proxy
- Health checks for service monitoring
- Proper networking between services

## Development Features

The development setup includes:
- Hot reloading for both frontend and backend
- Source code mounting
- Proper environment variables
- Debug-friendly configuration