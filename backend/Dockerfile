# Backend Dockerfile
FROM node:20-alpine

# Install useful tools
RUN apk add --no-cache nano curl

WORKDIR /app

# Create data directory for user persistence
RUN mkdir -p /app/data

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install --omit=dev

# Copy source code
COPY . .

# Expose port
EXPOSE 3201

# Environment variable for data persistence
ENV USERS_FILE=/app/data/users.json

# Start the server
CMD ["node", "src/index.js"]
