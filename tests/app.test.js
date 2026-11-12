const request = require('supertest');
const app = require('../src/server');

describe('Nexora service', () => {
  test('health endpoint reports service status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', service: 'nexora' });
  });

  test('protected API requires an authenticated session', async () => {
    const response = await request(app).get('/api/dashboard');
    expect(response.status).toBe(401);
  });

  test('login rejects invalid credentials', async () => {
    const response = await request(app).post('/api/auth/login').send({ email: 'nobody@example.com', password: 'wrong' });
    expect(response.status).toBe(401);
  });
});
