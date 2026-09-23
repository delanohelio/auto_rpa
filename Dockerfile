# Use the official Playwright image which includes Node.js and system dependencies for browsers
FROM mcr.microsoft.com/playwright:v1.44.0-jammy

# Set working directory
WORKDIR /app

# Install Xvfb for headless container environments that need virtual headed displays
RUN apt-get update && apt-get install -y --no-install-recommends xvfb && rm -rf /var/lib/apt/lists/*

# Copy package configurations
COPY package.json ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies for both backend and frontend
RUN npm install --prefix backend
RUN npm install --prefix frontend

# Copy the rest of the application code
COPY backend/ ./backend/
COPY frontend/ ./frontend/

# Build the frontend assets
RUN npm run build:frontend

# Expose the API and web server port
EXPOSE 3000

# Set environment variables
ENV NODE_ENV=production
ENV PORT=3000
ENV SECRET_KEY=default_super_secret_rpa_key_123

# Start the application with xvfb-run support for headed browser emulation in Docker
CMD ["sh", "-c", "if command -v xvfb-run > /dev/null 2>&1; then echo 'Iniciando AutoRPA com Xvfb (Virtual Framebuffer Display)...'; xvfb-run -a --server-args='-screen 0 1280x1024x24 -ac +extension GLX +render -noreset' node backend/src/server.js; else node backend/src/server.js; fi"]
