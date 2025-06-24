# Unit Testing Guide

This guide provides instructions and best practices for writing unit tests for the server-side of the TaskHive application.

## Table of Contents

1. [Introduction](#introduction)
2. [Tools](#tools)
3. [File Structure & Naming Conventions](#file-structure--naming-conventions)
4. [Running Tests](#running-tests)
5. [Writing Unit Tests for Controllers](#writing-unit-tests-for-controllers)
    - [Setting Up the Test File](#setting-up-the-test-file)
    - [Mocking Prisma Client](#mocking-prisma-client)
    - [Structuring the Test Suite](#structuring-the-test-suite)
    - [Writing a Test Case (Arrange, Act, Assert)](#writing-a-test-case-arrange-act-assert)
6. [Best Practices](#best-practices)

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
  - **Example:** The test for `src/controllers/team.controller.js` is located at `src/__tests__/unit/controllers/team.controller.test.js`.

### Running Tests

- **Run all tests:**

  ```bash
  npm test
  ```

- **Run tests for a specific file:**

  ```bash
  npm test -- server/src/__tests__/unit/controllers/task.controller.js
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
import prisma from '../../../../src/config/prismaClient';
import { someControllerFunction } from '../../../../src/controllers/some.controller';
// ... other imports
```

#### Mocking Prisma Client

To test controllers in isolation, we must mock the Prisma client. Due to how Jest's `jest.mock` hoisting works, we must define the mock within the factory function to avoid `ReferenceError`.

Place this at the top of your controller test file:

```javascript
jest.mock('../../../../src/config/prismaClient', () => {
  const prismaMock = {
    organization: { findFirst: jest.fn() },
    team: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    project: { findFirst: jest.fn() },
    sprint: { findFirst: jest.fn() },
    task: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
      delete: jest.fn(),
      deleteMany: jest.fn(),
    },
    user: { findUnique: jest.fn() },
    projectMember: { findFirst: jest.fn(), findMany: jest.fn() },
    // ... add other models and methods as needed
  };
  // Mock the transaction client
  prismaMock.$transaction = jest
    .fn()
    .mockImplementation(async (callback) => callback(prismaMock));

  return {
    __esModule: true,
    default: prismaMock,
  };
});
```

#### Structuring the Test Suite

Use `describe` blocks to organize your tests, and a `beforeEach` block to reset mocks and request/response objects before each test run.

```javascript
describe('Task Controller', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      query: {},
      user: { id: 'userId', role: 'USER' },
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
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
  prisma.organization.findFirst.mockResolvedValue({
    id: 'orgId',
    owners: [{ userId: 'userId' }],
  });
  prisma.team.findFirst.mockResolvedValue({ id: 'teamId' });
  prisma.project.findFirst.mockResolvedValue({ id: 'projectId' });
  prisma.task.create.mockResolvedValue({ id: 'taskId', ...req.body });

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
  expect(prisma.task.create).toHaveBeenCalledWith({
    data: expect.any(Object), // You can be more specific here
  });
  expect(next).not.toHaveBeenCalled();
});
```

### Best Practices

- **Test One Thing:** Each `it` block should have a single, clear responsibility.
- **Be Descriptive:** Use clear names for `describe` and `it` blocks. `describe('createTask')` and `it('should return 404 if organization is not found')` are good examples.
- **Cover All Cases:** For each controller, test:
  - The success "happy path" (2xx status).
  - Invalid input and validation errors (400 status).
  - Authorization failures (403 status).
  - Cases where a resource is not found (404 status).
  - Server errors by mocking a dependency to throw an error and asserting that `next(error)` is called.
- **Keep Tests Independent:** Use `beforeEach` to ensure that one test does not affect the outcome of another.
