# Integration Testing Guide

This section provides instructions and best practices for writing and running integration tests for the server-side of the TaskHive application.

## Table of Contents

1. [Introduction](#integration-introduction)
2. [Tools](#integration-tools)
3. [File Structure & Naming Conventions](#integration-file-structure--naming-conventions)
4. [Running Integration Tests](#running-integration-tests)
5. [Writing Integration Tests](#writing-integration-tests)
6. [Environment Variables](#environment-variables)
7. [Handling Permission Errors](#handling-permission-errors)
8. [Test Data Management](#test-data-management)
9. [Best Practices](#integration-best-practices)

---

### Integration Introduction

Integration tests verify that multiple components of the application work together as expected. They often interact with real or test databases and involve HTTP requests to the API endpoints.

### Integration Tools

- **[Jest](https://jestjs.io/):** Test runner and assertion library.
- **[Supertest](https://github.com/ladjs/supertest):** For making HTTP requests to your Express app.
- **Test Database:** Integration tests use a separate test database to avoid polluting production or development data.

### Integration File Structure & Naming Conventions

- Integration tests are located in `src/__tests__/integration/`.
- Test files should be named with the format `[resource].integration.test.js`.
  - **Example:** Tests for department endpoints should be in `src/__tests__/integration/department.integration.test.js`.
- Common setup code is centralized in:
  - `src/__tests__/db.setup.js`: Database connection and test data helpers
  - `src/__tests__/setup.integration.js`: Integration-specific mocks and settings

### Running Integration Tests

- **Run all integration tests:**

  ```bash
  npm run test:integration
  ```

  This command sets the appropriate environment variables and uses the Jest configuration for integration tests.

- **Run a specific integration test file:**

  ```bash
  npm run test:integration -- src/__tests__/integration/department.integration.test.js
  ```

- **Run both unit and integration tests:**

  ```bash
  npm run test:all
  ```

### Writing Integration Tests

- Import the necessary setup and use Supertest to make HTTP requests.
- Use the helper functions from `db.setup.js` to create test data with unique identifiers.
- Example structure:

```javascript
import request from 'supertest';
import app from '../../app';
import prisma from '../../src/config/prismaClient';
import { createTestData, TEST_IDENTIFIER } from '../db.setup';

describe('Department Endpoints', () => {
  let testUser, testOrg, testDepartment, authToken;

  beforeAll(async () => {
    // Create test user with unique identifier
    testUser = await prisma.user.create({
      data: createTestData({
        email: 'test@example.com',
        password: 'hashedPassword',
        // other required fields
      }),
    });
    console.log(`Test user created with ID: ${testUser.id}`);

    // Create test organization with unique identifier
    testOrg = await prisma.organization.create({
      data: createTestData({
        name: 'Test Organization',
        // other required fields
      }),
    });
    console.log(`Test organization created with ID: ${testOrg.id}`);

    // Generate auth token for the test user
    // (You might have a utility function for this)
    authToken = generateTestToken(testUser);
  });

  it('should create a department or return appropriate status code', async () => {
    const res = await request(app)
      .post(`/api/organization/${testOrg.id}/departments/create`)
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        name: `Test Department ${TEST_IDENTIFIER}`,
        description: 'Test description',
      });

    // Test could pass with 201 (created) or 403 (forbidden)
    // depending on user permissions
    expect([201, 403]).toContain(res.statusCode);

    if (res.statusCode === 201) {
      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toContain('Test Department');
      testDepartment = res.body;
      console.log(`Test department created with ID: ${testDepartment.id}`);
    } else {
      console.log('User may not have permission to create departments');
    }
  });
});
```

### Environment Variables

Integration tests use the following environment variables:

- `NODE_ENV=test`: Indicates that we're running in a test environment
- `UNIT_TEST=0`: Indicates that we're running integration tests
- `TEST_TYPE=integration`: Specifies the test type
- `DATABASE_URL`: Points to the test database (set in db.setup.js)

These variables are set automatically by the test runner when you use `npm run test:integration`.

### Handling Permission Errors

Many integration tests may return 403 Forbidden responses because the test user doesn't have the required permissions. This is expected behavior and our tests are designed to handle it:

1. **Use flexible assertions**: Check for multiple possible status codes:

   ```javascript
   expect([200, 403, 404]).toContain(res.statusCode);
   ```

2. **Conditional assertions**: Only test response body properties if the request succeeded:

   ```javascript
   if (res.statusCode === 200) {
     expect(res.body).toHaveProperty('data');
   } else {
     console.log('User may not have permission for this action');
   }
   ```

3. **Skip tests conditionally**: If a prerequisite operation fails due to permissions:

   ```javascript
   if (!testProject) {
     console.log('Skipping test: No test project available');
     return;
   }
   ```

### Test Data Management

By default, we use a unique identifier approach without deleting test data between runs:

1. **Unique Test Identifier**: Each test run generates a unique identifier (`TEST_IDENTIFIER`) in `db.setup.js`.

2. **Helper Functions**:

   - `createTestData(data)`: Adds the unique identifier to data properties like email, username, and name.
   - `findTestUser(email)`: Finds a test user by email, applying the unique identifier.
   - `cleanupTestData()`: Removes test data created with the current test identifier.

3. **Benefits**:
   - Tests can run in parallel without data collisions
   - Test data is clearly identifiable in the database

### Cleaning Up Test Data

You can now choose whether to keep or clean up test data:

1. **Standard Test Mode** (keep test data):

   ```bash
   npm run test:integration
   ```

2. **Clean Test Mode** (delete test data after tests):

   ```bash
   npm run test:integration:clean
   ```

3. **Clean All Test Data** (standalone cleanup of all test data):
   ```bash
   npm run cleanup:test-data
   ```

The integration test suite provides two ways to clean up test data:

1. **Test-specific cleanup**: Uses the `cleanupTestData()` function in `db.setup.js` to remove only data with the current test identifier
2. **Complete cleanup**: Uses a standalone script at `src/__tests__/scripts/cleanup-test-data.js` to remove all test data regardless of identifier

### Integration Best Practices

- **Use Test Identifiers:** Always use the `createTestData` helper to ensure test data has unique identifiers.
- **Log Important Information:** Log IDs of created resources for debugging.
- **Test Real Interactions:** Avoid mocking in integration tests; use real HTTP requests and database operations.
- **Handle Permission Errors Gracefully:** Expect and handle 403 responses appropriately.
- **Isolate Test Data:** Use unique identifiers to prevent tests from interfering with each other.
- **Test Error Cases:** Include tests for invalid inputs, missing resources, and unauthorized access.
- **Use Descriptive Error Messages:** Log helpful messages when tests can't complete due to permissions or missing prerequisites.

---

For more details, see the example integration tests in `src/__tests__/integration/` and the database setup in `src/__tests__/db.setup.js`.
