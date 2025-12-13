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

# Create storage directory
RUN mkdir -p /app/storage && chown -R kestra:kestra /app/storage
RUN chown -R kestra:kestra /app/ai-autofix

# Switch back to kestra user
USER kestra

# Set environment variables for Railway
ENV KESTRA_CONFIGURATION="\
    datasources:\n\
    postgres:\n\
    url: jdbc:h2:mem:public;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE\n\
    driverClassName: org.h2.Driver\n\
    kestra:\n\
    repository:\n\
    type: memory\n\
    queue:\n\
    type: memory\n\
    storage:\n\
    type: local\n\
    local:\n\
    base-path: /app/storage\n\
    micronaut:\n\
    server:\n\
    port: ${PORT:-8080}\n\
    cors:\n\
    enabled: true\n\
    configurations:\n\
    web:\n\
    allowedOrigins:\n\
    - '*'\n\
    allowedMethods:\n\
    - HEAD\n\
    - GET\n\
    - POST\n\
    - PUT\n\
    - DELETE\n\
    - OPTIONS\n\
    allowedHeaders:\n\
    - Content-Type\n\
    - Authorization\n\
    allowCredentials: true\n\
    "

# Expose port
EXPOSE 8080

# Override the base image's CMD (which is ["--help"])
# The ENTRYPOINT is docker-entrypoint.sh which calls /app/kestra
CMD ["server", "standalone"]

