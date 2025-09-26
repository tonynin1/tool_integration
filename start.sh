#!/bin/bash

echo "🐳 Starting Confluence Tool Docker Services..."

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ docker-compose could not be found. Please install Docker Compose."
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Default to production mode
MODE=${1:-production}

case $MODE in
    "dev" | "development")
        echo "🚀 Starting in development mode..."
        docker-compose -f docker-compose.dev.yml up --build
        ;;
    "prod" | "production")
        echo "🚀 Starting in production mode..."
        docker-compose up --build
        ;;
    *)
        echo "Usage: $0 [dev|prod]"
        echo "  dev  - Start in development mode with hot reloading"
        echo "  prod - Start in production mode (default)"
        exit 1
        ;;
esac