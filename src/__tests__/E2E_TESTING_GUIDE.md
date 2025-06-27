# End-to-End Testing Guide

This guide provides instructions and best practices for writing and running end-to-end (E2E) tests for the TaskHive application.

## Table of Contents

1. [Introduction](#introduction)
2. [Tools](#tools)
3. [File Structure & Naming Conventions](#file-structure--naming-conventions)
4. [Running E2E Tests](#running-e2e-tests)
5. [Writing E2E Tests](#writing-e2e-tests)
6. [Best Practices](#best-practices)

---

### Introduction

End-to-end (E2E) tests verify that the entire application works as expected from a user's perspective. These tests simulate real user workflows from start to finish, ensuring that all components of the application work together correctly.

Unlike unit tests (which test individual functions in isolation) or integration tests (which test how components work together), E2E tests verify entire user stories or workflows across the application.

### Tools

- **[Jest](https://jestjs.io/):** Test runner and assertion library.
- **[Supertest](https://github.com/ladjs/supertest):** For making HTTP requests to your Express app.
- **Test Database:** E2E tests use the same test database as integration tests to avoid polluting production or development data.

### File Structure & Naming Conventions

- E2E tests are located in `src/__tests__/e2e/`.
- Test files should be named with the format `[resource].e2e.test.js`.
  - **Example:** E2E tests for auth workflows should be in `src/__tests__/e2e/auth.e2e.test.js`.
- Common setup code is centralized in:
  - `src/__tests__/db.setup.js`: Database connection and test data helpers
  - `src/__tests__/setup.integration.js`: Also used for E2E tests for mocks and settings

### Running E2E Tests

- **Run all E2E tests (preserving test data):**

  ```bash
  npm run test:e2e
  ```

  This command sets the appropriate environment variables and uses the Jest configuration for E2E tests.

- **Run all E2E tests and clean up test data after tests:**

  ```bash
  npm run test:e2e:clean
  ```

  This runs the tests and deletes all test data created during this test run.

- **Run a specific E2E test file:**

  ```bash
  npm run test:e2e -- src/__tests__/e2e/auth.e2e.test.js
  ```

  To clean up test data when running a specific file:

  ```bash
  npm run test:e2e:clean -- src/__tests__/e2e/auth.e2e.test.js
  ```

- **Run all tests (unit, integration, and E2E):**

  ```bash
  npm run test:all
  ```

  Or, to clean up test data:

  ```bash
  npm run test:all:clean
  ```

- **Clean up all existing test data without running tests:**

  ```bash
  npm run cleanup:test-data
  ```

### Writing E2E Tests

E2E tests should focus on complete user workflows rather than individual endpoints. Each test file should contain one or more complete workflows that a real user might perform.

#### Key Principles

1. **Test Complete Workflows:** Each test file should cover a complete user journey (e.g., registration through to performing actions as an authenticated user).
2. **Sequential Tests:** E2E tests are often sequential and depend on the state created by previous tests.
3. **Clean Up After Tests:** Use `afterAll` to clean up test data created during the E2E tests.

#### Example Structure

```javascript
import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import { app } from '../../index.js';
import prisma, { createTestData, TEST_IDENTIFIER } from '../db.setup.js';

describe('User Workflow', () => {
  // Store data that will be used across tests
  const testData = {
    userData: null,
    userId: null,
    accessToken: null,
  };

  // Before all tests
  beforeAll(() => {
    // Setup test data
    testData.userData = createTestData({
      email: 'workflow-test@example.com',
      // other user data
    });
  });

  // Clean up after tests
  afterAll(async () => {
    // Cleanup code
  });

  it('STEP 1: Register a new user', async () => {
    // Test registration
    // Store response data in testData for use in subsequent tests
  });

  it('STEP 2: Verify email', async () => {
    // Use data from previous step
    // Test email verification
  });

  it('STEP 3: Login', async () => {
    // Use data from previous steps
    // Test login
    // Store tokens
  });

  // Additional workflow steps
});
```

### Best Practices

1. **Name Tests as Steps:** Prefix test names with "STEP X:" to make the workflow clear.
2. **Store Shared Data:** Use a shared object to store data that needs to be used across different test steps.
3. **Handle Failures Gracefully:** If a critical step fails, consider using conditional logic to skip dependent tests.
4. **Avoid Dependencies Between Test Suites:** Each test file should be able to run independently.
5. **Test Real User Scenarios:** Focus on testing real user workflows rather than edge cases (leave those to unit and integration tests).
6. **Document Workflows:** Include clear comments explaining the workflow being tested.
7. **Clean Up Test Data:** Always clean up data created during tests to avoid polluting the test database.
8. **Set Appropriate Timeouts:** E2E tests often take longer to run, so set appropriate timeouts.

---

For more details, see the example E2E tests in `src/__tests__/e2e/` and the database setup in `src/__tests__/db.setup.js`.

## Key Principles -

1. **Test Complete Workflows**: E2E tests should verify entire user flows from start to finish, not just individual endpoints.
2. **Data Isolation**: Tests should use unique, identifiable test data, and should NOT delete records from the database.
3. **Independence**: Tests should be able to run independently without relying on other tests.
4. **Resilience**: Tests should handle various response codes and edge cases.

## Testing Approach

### Data Management

- **DO NOT DELETE DATA**: Our tests are designed to preserve data integrity. We never delete records from the database.
- **Data Isolation**: Use the `createTestData()` helper to create unique test identifiers for data.
- **Check for Existing Data**: Before creating test data, check if it already exists and use it if available.
- **Cleanup Strategy**: Instead of deleting test data, our tests are designed to work with existing test data or create new isolated test data.

### Test Structure

1. **Setup Phase**: Prepare the environment and any needed test data.
2. **Execution Phase**: Run through a complete user workflow.
3. **Assertion Phase**: Verify the expected outcomes.
4. **No Cleanup Phase**: We preserve all data in the database.

### Best Practices --

- Create unique test data using timestamps or random identifiers.
- Handle cases where test data might already exist.
- Add conditional logic to skip steps when prerequisites fail.
- Always check database state to validate changes.
- Use descriptive step names (e.g., "STEP 1: Registration") to make test flows clear.
- Add proper logging to help with debugging.
- **Avoid Direct Database Queries**: When possible, test through the API rather than making direct database queries.
- **Mock Soft Deletes**: For operations that involve deletion, use mocks to simulate the deletion without actually removing data.

## Available Test Workflows

### 1. Authentication Workflow

Tests the complete user authentication flow from registration to logout:

- User registration
- Email verification with OTP
- Login with verified account
- Password reset flow
- Token refresh
- Logout

### 2. Organization Workflow

Tests the complete organization management flow:

- Organization creation
- Checking organization status
- Listing organizations with pagination
- Updating organization details
- Joining an organization with a join code
- Preserving organization data (no deletion)

### 3. Department Workflow

Tests the complete department management flow within an organization:

- Listing all departments in an organization
- Retrieving departments managed by the current user
- Getting detailed department information by ID
- Creating a new department
- Updating department details
- Soft deleting a department (mock only, no actual deletion)
- Restoring a soft-deleted department
- Verifying department data preservation

### 4. Team Workflow

Tests the complete team management flow within an organization:

- Listing all teams in an organization
- Getting detailed team information by ID
- Creating a new team
- Updating team details
- Adding members to a team
- Removing members from a team (mock only, no actual deletion)
- Soft deleting a team (mock only, no actual deletion)
- Verifying team data preservation

### 5. Project Workflow

Tests the complete project management flow within teams and organizations:

- Listing all projects in a team
- Listing all projects in an organization
- Getting detailed project information by ID
- Creating a new project
- Updating project details
- Updating project status
- Updating project priority
- Adding members to a project
- Removing members from a project (mock only, no actual deletion)
- Soft deleting a project (mock only, no actual deletion)
- Restoring a soft-deleted project
- Verifying project data preservation

### 6. Sprint Workflow

Tests the complete sprint management flow within projects:

- Listing all sprints in a project
- Getting detailed sprint information by ID
- Creating a new sprint
- Validating sprint date constraints (no overlapping sprints)
- Updating sprint details
- Updating sprint status with proper transitions
- Validating business rules (cannot complete sprints with unfinished tasks)
- Soft deleting a sprint (mock only, no actual deletion)
- Verifying sprint data preservation

### 7. Task Workflow

Tests the complete task management flow within projects:

- Creating tasks with various properties (priority, due date, labels)
- Validating required fields and business rules
- Updating task details
- Updating task status with proper transitions
- Updating task priority
- Filtering and searching tasks
- Managing task assignments
- Creating task hierarchies (parent-child relationships)
- Soft deleting tasks (mock only, no actual deletion)
- Restoring soft-deleted tasks
- Organization-wide task management and reporting
- Verifying task data preservation

## Example Test Flow

```javascript
describe('Department E2E Workflow', () => {
  // Test data preparation
  beforeAll(async () => {
    // Create test-specific department data
    testData.departmentData = createTestData({ ... });

    // For testing purposes, use mock IDs
    testData.departmentId = 'mock-dept-id-1';
  });

  it('STEP 1: should get all departments for an organization', async () => {
    const res = await request(app)
      .get(`/api/organizations/${testData.organizationId}/departments`)
      .query({ page: 1 });

    expect([200, 500]).toContain(res.statusCode);

    if (res.statusCode === 200) {
      expect(res.body).toHaveProperty('success', true);
      // Additional assertions...
    }
  });

  // Additional test steps...
});
```

## Running E2E Tests -

```bash
# Run all E2E tests
npm run test:e2e

# Run specific E2E tests
npm run test:e2e -- -t "Auth E2E Workflow"
npm run test:e2e -- -t "Organization E2E Workflow"
npm run test:e2e -- -t "Department E2E Workflow"
npm run test:e2e -- -t "Team E2E Workflow"
npm run test:e2e -- -t "Project E2E Workflow"
npm run test:e2e -- -t "Sprint E2E Workflow"
npm run test:e2e -- -t "Task E2E Workflow"
```
