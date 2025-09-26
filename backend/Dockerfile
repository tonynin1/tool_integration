# Use Node.js official image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install Python and dependencies needed for the update script
RUN apk add --no-cache python3 py3-pip

# Create and activate virtual environment, then install requirements
COPY requirements.txt ./
RUN python3 -m venv /app/venv && \
    /app/venv/bin/pip install -r requirements.txt

# Update PATH to use virtual environment
ENV PATH="/app/venv/bin:$PATH"

# Copy package files
COPY package*.json ./

# Install dependencies (if any)
RUN npm install

# Copy server file
COPY confluence-server-combined.js ./

# Copy Python script (if it exists in the root)
COPY update_gwm_precise_refactored.py* ./

# Expose port
EXPOSE 3002

# Create a non-root user
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodeuser -u 1001

# Change ownership of the app directory
RUN chown -R nodeuser:nodejs /app
USER nodeuser

# Start the server
CMD ["node", "confluence-server-combined.js"]