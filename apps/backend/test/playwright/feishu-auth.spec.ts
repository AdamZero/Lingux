import { test, expect } from '@playwright/test';

test('Feishu auth callback should handle invalid code gracefully', async ({ request }) => {
  // Test with an invalid code
  const response = await request.get('/api/v1/auth/feishu/callback', {
    params: {
      code: 'invalid_code_123456'
    }
  });
  
  // The response should be a 500 error since the code is invalid
  expect(response.status()).toBe(500);
  
  // The response should contain an error message
  const responseBody = await response.json();
  expect(responseBody).toHaveProperty('statusCode', 500);
  expect(responseBody).toHaveProperty('message', 'Internal server error');
});

test('Feishu auth callback should handle missing code', async ({ request }) => {
  // Test without a code parameter
  const response = await request.get('/api/v1/auth/feishu/callback');
  
  // The response should be a 500 error since the code is missing
  expect(response.status()).toBe(500);
  
  // The response should contain an error message
  const responseBody = await response.json();
  expect(responseBody).toHaveProperty('statusCode', 500);
  expect(responseBody).toHaveProperty('message', 'Internal server error');
});