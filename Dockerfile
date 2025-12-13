FROM kestra/kestra:latest

# Install Node.js and npm
USER root
RUN apt-get update && \
    apt-get install -y curl && \
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash - && \
    apt-get install -y nodejs git && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Verify installation
RUN node --version && npm --version

# Set working directory for our app
WORKDIR /app/ai-autofix

# Copy application files
COPY package*.json ./
RUN npm install --production

COPY src ./src
COPY prompts ./prompts
COPY kestra/workflows ./workflows

# Create Kestra configuration file for Railway (as root before switching users)
RUN cat <<EOF > /app/application.yml
datasources:
  postgres:
    url: jdbc:h2:mem:public;MODE=PostgreSQL;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
    driverClassName: org.h2.Driver
kestra:
  repository:
    type: memory
  queue:
    type: memory
  storage:
    type: local
    local:
      base-path: /app/storage
micronaut:
  server:
    port: 8080
    cors:
      enabled: true
      configurations:
        web:
          allowedOrigins:
            - "*"
          allowedMethods:
            - HEAD
            - GET
            - POST
            - PUT
            - DELETE
            - OPTIONS
          allowedHeaders:
            - Content-Type
            - Authorization
          allowCredentials: true
EOF

# Create storage directory and set permissions
RUN mkdir -p /app/storage && \
    chown -R kestra:kestra /app/storage && \
    chown -R kestra:kestra /app/ai-autofix && \
    chown kestra:kestra /app/application.yml

# Switch back to kestra user
USER kestra

# Set the config file location
ENV MICRONAUT_CONFIG_FILES=/app/application.yml

# Expose port
EXPOSE 8080

# Override the base image's CMD (which is ["--help"])
# The ENTRYPOINT is docker-entrypoint.sh which calls /app/kestra
CMD ["server", "standalone"]
