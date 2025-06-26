# TaskHive Server

[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/TaskTrial/server)

This repository contains the server-side implementation of TaskHive, providing **backend logic**, **database interactions**, and **RESTful APIs** for the TaskHive application.

## Usage

You can test your APIs using **_Swagger_** from [_link here_](http://localhost:3000/api-docs/) after running the server

base url: `http://localhost:3000`

### Running the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run start:prod

# Test environment
npm run start:test
```

### Environment Configuration

- **Development**: Uses local environment variables with verbose logging for debugging
- **Production**: Uses production configuration, optimized for performance and security
- **Test**: Used for running the application during testing with mock services

## Database Setup

The project uses PostgreSQL with Prisma ORM. Initial setup:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev
```

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
```

### Testing Guidelines

- **Unit Tests**: Test individual functions and components in isolation
- **Integration Tests**: Test interactions between multiple components (API endpoints, database)
- **E2E Tests**: Test complete workflows from start to finish

### Common Testing Issues & Solutions

- **Port conflicts**: Integration tests run serially with `--runInBand` to avoid port conflicts
- **Database setup**: Tests use a separate test database to avoid affecting development data
- **Test data**: Use the provided test data helpers for consistent test data generation

## API Documentation

The API is documented using Swagger. Once the server is running, you can access the documentation at:

```bash
http://localhost:3000/api-docs
```
