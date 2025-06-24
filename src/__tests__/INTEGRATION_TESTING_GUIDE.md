# Integration Testing Guide

This section provides instructions and best practices for writing and running integration tests for the server-side of the TaskHive application.

## Table of Contents

1. [Introduction](#integration-introduction)
2. [Tools](#integration-tools)
3. [File Structure & Naming Conventions](#integration-file-structure--naming-conventions)
4. [Running Integration Tests](#running-integration-tests)
5. [Writing Integration Tests](#writing-integration-tests)
6. [Best Practices](#integration-best-practices)

---

### Integration Introduction

Integration tests verify that multiple components of the application work together as expected. They often interact with real or test databases and may involve HTTP requests to the API endpoints.

### Integration Tools

- **[Jest](https://jestjs.io/):** Test runner and assertion library.
- **[Supertest](https://github.com/ladjs/supertest):** For making HTTP requests to your Express app.
- **Test Database:** Integration tests should use a separate test database to avoid polluting production or development data.

### Integration File Structure & Naming Conventions

- Integration tests are located in `src/__tests__/integration/`.
- Test files should mirror the structure of the source code and be named with a `.test.js` extension.
  - **Example:** Tests for `src/routes/chat.routes.js` should be in `src/__tests__/integration/routes/chat.routes.test.js`.

### Running Integration Tests

- **Run all integration tests:**

  ```bash
  npm run test:integration
  ```

  This command uses a custom Jest config (`jest.config.integration.js`) and Node options for ESM support.

- **Run a specific integration test file:**

  ```bash
  npm run test:integration -- src/__tests__/integration/routes/chat.routes.test.js
  ```

- **Run both unit and integration tests:**

  ```bash
  npm run test:all
  ```

### Writing Integration Tests

- Import your Express app and use Supertest to make HTTP requests.
- Use a test database. Ensure setup/teardown scripts clean up data between tests.
- Example structure:

```javascript
import request from 'supertest';
import app from '../../../src/index';

describe('Chat API Integration', () => {
  it('should create a new chat message', async () => {
    const res = await request(app)
      .post('/api/chat')
      .send({ message: 'Hello', userId: 'user1' });
    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('message', 'Hello');
  });
});
```

- Use `beforeAll`/`afterAll` or `beforeEach`/`afterEach` to set up and tear down test data.

### Integration Best Practices

- **Isolate Test Data:** Use a separate test database and clean up between tests.
- **Test Real Interactions:** Avoid mocking for integration tests; use real HTTP requests and database operations.
- **Environment Variables:** Use environment variables to point to your test database (e.g., `NODE_ENV=test`).
- **Keep Tests Fast:** Seed only necessary data and clean up efficiently.
- **Error Handling:** Test both success and failure scenarios (e.g., invalid input, unauthorized access).
- **Parallelization:** If tests run in parallel, ensure no data collisions.

---

For more details, see the example integration tests in `src/__tests__/integration/` and the custom Jest config in `jest.config.integration.js`.
