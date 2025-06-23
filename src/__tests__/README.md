# Testing Guide

This directory contains comprehensive unit tests for the server controllers and other components.

## Structure

```bash
src/__tests__/
├── setup.js                           # Global test setup and mocks
├── unit/                              # Unit tests
│   └── controllers/                   # Controller unit tests
│       ├── auth.controller.test.js    # Authentication controller tests
│       ├── user.controller.test.js    # User management controller tests
│       ├── organization.controller.test.js # Organization controller tests
│       └── task.controller.test.js    # Task management controller tests
└── integration/                       # Integration tests (future)
```

## Running Tests

### All Tests

```bash
npm test
```

### Unit Tests Only

```bash
npm run test:unit
```

### Watch Mode

```bash
npm run test:watch
```

### Coverage Report

```bash
npm run test:coverage
```

## Test Setup

The testing environment is configured with:

- **Jest**: Testing framework
- **Supertest**: HTTP testing for API endpoints
- **ES Modules**: Support for ES6 imports
- **Mocking**: Comprehensive mocking of external dependencies

### Global Mocks

The `setup.js` file provides:

1. **Environment Variables**: Test environment configuration
2. **Prisma Client**: Mocked database operations
3. **Utility Functions**: Mocked password, OTP, email, and token utilities
4. **Global Test Utilities**: Helper functions for creating mock requests/responses

### Test Utilities

```javascript
// Mock request object
const req = mockRequest(body, params, query, headers);

// Mock response object
const res = mockResponse();

// Mock next function
const next = mockNext();
```

## Writing Tests

### Controller Test Structure

```javascript
/* eslint-env node */
import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import prisma from '../../../config/prismaClient.js';
import { functionName } from '../../../controllers/controllerName.js';

describe('Controller Name', () => {
  let req, res, next;

  beforeEach(() => {
    req = mockRequest();
    res = mockResponse();
    next = jest.fn();
    jest.clearAllMocks();
  });

  describe('functionName', () => {
    it('should handle success case', async () => {
      // Arrange
      req.body = {
        /* test data */
      };

      // Mock dependencies
      prisma.model.findFirst.mockResolvedValue(/* mock data */);

      // Act
      await functionName(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(/* expected response */);
    });

    it('should handle error case', async () => {
      // Arrange
      req.body = {
        /* invalid data */
      };

      // Act
      await functionName(req, res, next);

      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Error message',
      });
    });
  });
});
```

## Current Test Status

### Organization Controller

- ✅ All tests passing

### Auth Controller

- ✅ User registration (signup)
- ❌ User login (signin) - Status code mismatch (expected 200, actual 403)
- ❌ Email verification - Status code mismatch (expected 200, actual 400)
- ✅ OTP resend
- ✅ Password reset
- ❌ User logout - Response not being returned

### User Controller

- ❌ Get all users - Response format mismatch
- ❌ Get user by ID - Status code mismatch (expected 200, actual 404)
- ❌ Update user account - Status code mismatch (expected 200, actual 404)
- ❌ Update user password - No response
- ❌ Soft delete user - Status code mismatch (expected 200, actual 404)
- ❌ Upload/delete profile picture - Status code mismatch (expected 200, actual 404)

### Task Controller

- ❌ Create task - Status code mismatch (expected 201, actual 400)
- ❌ Get tasks - Status code mismatch (expected 200, actual 404)
- ❌ Get task by ID - Status code mismatch (expected 200, actual 404)
- ❌ Update task - Status code mismatch (expected 200, actual 404)
- ❌ Delete task - Status code mismatch (expected 200, actual 404)
- ❌ Update task status - Status code mismatch (expected 200, actual 404)

## Troubleshooting Guide

### Common Issues

1. **Status Code Mismatches**: The controller might be returning a different status code than expected in the test. Update either the controller or the test to match.

2. **Response Format Mismatches**: The controller might be returning a different response structure than expected. Check the actual response and update the test expectations.

3. **Missing Responses**: The controller might not be calling `res.status()` or `res.json()`. Check the controller implementation.

4. **Mock Function Issues**: Ensure that all mocks are properly set up and cleared between tests.

5. **Function Name Mismatches**: Ensure that the function names in the imports match the actual exported functions in the controllers.

### Fixing Status Code Mismatches

For tests with status code mismatches, you can:

1. Update the test to match the actual status code returned by the controller:

   ```javascript
   expect(res.status).toHaveBeenCalledWith(403); // Instead of 200
   ```

2. Or update the controller to return the expected status code:

   ```javascript
   res.status(200).json({ ... }); // Instead of 403
   ```

### Fixing Response Format Mismatches

For tests with response format mismatches, you can:

1. Update the test to match the actual response format:

   ```javascript
   expect(res.json).toHaveBeenCalledWith({
     message: 'Users retrieved successfully', // Add this field
     users: mockUsers,
     currentPage: 2,
     totalPages: 3,
     totalUsers: 25,
   });
   ```

2. Or update the controller to return the expected response format:

```javascript
res.status(200).json({
  users: users,
  currentPage: page,
  totalPages: totalPages,
  totalUsers: totalCount,
  // Remove the message field
});
```

### Fixing Missing Responses

For tests where the controller is not returning a response:

1. Check that the controller is properly calling `res.status()` and `res.json()`.
2. Check for any error handling issues that might prevent the response from being sent.
3. Check for any asynchronous operations that might not be properly awaited.

## Next Steps

1. Fix the failing tests by addressing the issues mentioned above.
2. Add more tests for other controllers.
3. Add integration tests for API endpoints.
4. Add end-to-end tests for critical user flows.
