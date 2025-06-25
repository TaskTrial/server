# Unit Testing Guide

This guide provides instructions and best practices for writing unit tests for the server-side of the TaskHive application.

## Table of Contents

1. [Introduction](#introduction)
2. [Tools](#tools)
3. [File Structure & Naming Conventions](#file-structure--naming-conventions)
4. [Running Tests](#running-tests)
5. [Writing Unit Tests for Controllers](#writing-unit-tests-for-controllers)
   - [Setting Up the Test File](#setting-up-the-test-file)
   - [Using the Centralized Mock Setup](#using-the-centralized-mock-setup)
   - [Structuring the Test Suite](#structuring-the-test-suite)
   - [Writing a Test Case (Arrange, Act, Assert)](#writing-a-test-case-arrange-act-assert)
6. [Environment Variables](#environment-variables)
7. [Best Practices](#best-practices)

---

### Introduction

Unit tests are essential for ensuring code quality, preventing regressions, and providing clear documentation of how individual components are expected to behave. In this project, unit tests focus on isolating and testing a single "unit" of work, such as a controller function, in complete isolation from its dependencies (like the database).

### Tools

- **[Jest](https://jestjs.io/):** The primary testing framework, providing the test runner, assertion library, and mocking capabilities.
- **[Prisma Client Mock](https://www.prisma.io/docs/guides/testing/unit-testing):** We use Jest's built-in mocking features to create a mock of the Prisma client for database isolation.

### File Structure & Naming Conventions

- All test files are located in the `src/__tests__` directory.
- Unit tests are placed in `src/__tests__/unit/`.
- The test file for a source file should mirror its location and be named with a `.test.js` extension.
  - **Example:** The test for `src/controllers/team.controller.js` is located at `src/__tests__/unit/team.controller.test.js`.
- Common mocking setup is centralized in `src/__tests__/setup.js`.

### Running Tests

- **Run all tests:**

  ```bash
  npm test
  ```

- **Run tests for a specific file:**

  ```bash
  npm test -- src/__tests__/unit/auth.unit.test.js
  ```

- **Run tests in watch mode (reruns on file changes):**

  ```bash
  npm test -- --watch
  ```

### Writing Unit Tests for Controllers

#### Setting Up the Test File

A typical controller test file starts with imports, mock setups, and the main `describe` block.

```javascript
import { jest, describe, beforeEach, it, expect } from '@jest/globals';
import {
  mockPrisma,
  mockHashPassword,
  mockComparePassword,
  // other mocks as needed
} from '../setup.js';

// Mock Prisma client
jest.mock('../../config/prismaClient.js', () => {
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

// Import the controller after mocking dependencies
import { someControllerFunction } from '../../controllers/some.controller.js';
```

#### Using the Centralized Mock Setup

We use a centralized mock setup in `src/__tests__/setup.js` to ensure consistency across tests. This file provides:

1. Mock implementations for common utilities (password hashing, OTP generation, etc.)
2. A chainable mock Prisma client with all necessary models and methods
3. Global test utilities like `mockRequest()` and `mockResponse()`

The setup file automatically detects if we're running unit or integration tests and configures mocks accordingly.

To use the mocks in your test:

```javascript
// Import the mocks you need
import {
  mockPrisma,
  mockHashPassword,
  mockComparePassword,
  // other mocks as needed
} from '../setup.js';

// Mock Prisma client - IMPORTANT: Do this before importing controllers
jest.mock('../../config/prismaClient.js', () => {
  return {
    __esModule: true,
    default: mockPrisma,
  };
});

// Now you can configure mock behaviors in your tests
mockPrisma.user.findFirst.mockResolvedValue({
  id: 'user-id',
  email: 'test@example.com',
});
```

#### Structuring the Test Suite

Use `describe` blocks to organize your tests, and a `beforeEach` block to reset mocks and request/response objects before each test run.

```javascript
describe('Task Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks(); // Resets all mocks
  });

  // ... your test cases (it blocks) go here
});
```

#### Writing a Test Case (Arrange, Act, Assert)

Each `it` block should test a single scenario and follow the "Arrange, Act, Assert" pattern.

```javascript
it('should create a task successfully', async () => {
  // 1. Arrange
  // Setup request objects
  req.params = {
    organizationId: 'orgId',
    teamId: 'teamId',
    projectId: 'projectId',
  };
  req.body = {
    title: 'New Task',
    priority: 'HIGH',
    dueDate: new Date().toISOString(),
  };
  req.user = { id: 'userId', role: 'ADMIN' };

  // Setup mock return values for Prisma calls
  mockPrisma.organization.findFirst.mockResolvedValue({
    id: 'orgId',
    owners: [{ userId: 'userId' }],
  });
  mockPrisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
  mockPrisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
  mockPrisma.task.create.mockResolvedValue({ id: 'taskId', ...req.body });

  // 2. Act
  // Execute the function under test
  await createTask(req, res, next);

  // 3. Assert
  // Check the response and whether mocks were called correctly
  expect(res.status).toHaveBeenCalledWith(201);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: true,
      message: 'Task created successfully',
    }),
  );
  expect(mockPrisma.task.create).toHaveBeenCalledWith({
    data: expect.any(Object), // You can be more specific here
  });
  expect(next).not.toHaveBeenCalled();
});
```

### Environment Variables

The testing environment is configured using the following environment variables:

- `NODE_ENV=test`: Indicates that we're running in a test environment
- `UNIT_TEST=1`: Set automatically by Jest when running unit tests
- `TEST_TYPE=unit|integration`: Determines which test type is being run

These variables are set automatically by the test runner based on the command you use (`npm test` or `npm run test:integration`).

### Best Practices

- **Test One Thing:** Each `it` block should have a single, clear responsibility.
- **Be Descriptive:** Use clear names for `describe` and `it` blocks. `describe('createTask')` and `it('should return 404 if organization is not found')` are good examples.
- **Import Order Matters:** Always mock dependencies before importing the modules that use them.
- **Cover All Cases:** For each controller, test:
  - The success "happy path" (2xx status).
  - Invalid input and validation errors (400 status).
  - Authorization failures (403 status).
  - Cases where a resource is not found (404 status).
  - Server errors by mocking a dependency to throw an error and asserting that `next(error)` is called.
- **Keep Tests Independent:** Use `beforeEach` to ensure that one test does not affect the outcome of another.
- **Use the Centralized Mocks:** Leverage the mocks in `setup.js` rather than creating your own to ensure consistency.
