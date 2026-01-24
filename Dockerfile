FROM node:lts-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy source code
COPY ./app ./app
COPY ./public ./public
COPY ./lib ./lib
COPY ./next.config.js .
COPY ./tsconfig.json .
COPY ./proxy.ts .

# Build the app
RUN npm run build

# Create data directory
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["npm", "start"]
