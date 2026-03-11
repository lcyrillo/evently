# Use the full Node 20 image to avoid installing extra build tools
FROM node:20

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./

# Set environment variables to bypass SSL certificate issues globally
# This is necessary for corporate proxies that use self-signed certificates
ENV NODE_TLS_REJECT_UNAUTHORIZED=0

# Optimized npm install:
# --no-audit and --no-fund skip slow network-heavy checks
# strict-ssl false bypasses SSL issues for npm specifically
# --loglevel info lets you see exactly what it's doing
RUN npm config set strict-ssl false && \
    npm install --no-audit --no-fund --loglevel info

# Copy the rest of your code
COPY . .

# Build the frontend
RUN npm run build

# Set environment to production
ENV NODE_ENV=production

# Expose the port
EXPOSE 3000

# Start the application
# Using npx to run the server directly for better reliability
CMD ["npx", "tsx", "server.ts"]
