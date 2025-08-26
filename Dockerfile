# Base image
FROM mcr.microsoft.com/playwright:v1.47.0-focal

# Set working dir
WORKDIR /app

# Copy package.json + lock file
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy rest of app
COPY . .

# Expose port for Next.js
EXPOSE 3000

# Build Next.js
RUN npm run build

# Start Next.js in production
CMD ["npm", "start"]
