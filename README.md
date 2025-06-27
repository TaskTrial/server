# TaskHive Server

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/TaskTrial/server)

This repository contains the server-side implementation of TaskHive, providing **backend logic**, **database interactions**, and **RESTful APIs** for the TaskHive application.

## Usage

base url: `http://localhost:3000`

The API is documented using **Swagger**. Once the server is running, you can access the documentation at:

```bash
http://localhost:3000/api-docs
```

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod

# Test environment
npm run start:test
```

## Docker Setup

The application is containerized with Docker and supports multiple environments.

### Docker Environments

- **Development**: For local development with hot reloading
- **Testing**: For running tests in isolated environment
- **Production**: Optimized for deployment

### Building and Running with Docker in detached mode

```bash
# Development environment
docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build -d

# Testing environment
docker compose -f docker-compose.yml -f docker-compose.test.yml up --build -d

# Production environment
docker compose -f docker-compose.yml -f docker-compose.prod.yml up --build -d
```

### Nginx Configuration

The application includes Nginx as a reverse proxy with the following benefits:

- Load balancing
- SSL termination
- Static file serving
- API gateway functionality

Access the application through Nginx at:

```bash
http://localhost:8080
```

### Docker Hub Integration

The Docker image is published to Docker Hub:

```bash
# Pull the latest image
docker pull mdawoud27/tasktrial:latest

# Pull a specific version by commit SHA
docker pull mdawoud27/tasktrial:[SHA]
```

### CI/CD Pipeline

The GitHub Actions workflow automatically:

1. Runs linting and tests
2. Builds Docker image for production
3. Pushes to Docker Hub with appropriate tags

This happens automatically on pushes to the main branch after all tests pass.

### Environment Configuration

- **Development**: Uses local environment variables with verbose logging for debugging
- **Production**: Uses production configuration, optimized for performance and security
- **Test**: Used for running the application during testing with mock services

## Testing

The project uses Jest as the testing framework with distinct configurations for different test types.

### Running Tests

```bash
# Run all unit tests
npm run test
# or
npm run test:unit

# Run unit tests in watch mode
npm run test:watch

# Generate test coverage report
npm run test:coverage

# Run integration tests (runs serially with --runInBand)
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Run all test suites
npm run test:all

# Delete test data from db
npm run cleanup:test-data
```

### Testing Guidelines

- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test interactions between multiple components (API endpoints, database)
- **E2E Tests**: Test complete workflows from start to finish

### Common Testing Issues & Solutions

- **Port conflicts**: Integration tests run serially with `--runInBand` to avoid port conflicts
- **Database setup**: Tests use a separate test database to avoid affecting development data
- **Test data**: Use the provided test data helpers for consistent test data generation
