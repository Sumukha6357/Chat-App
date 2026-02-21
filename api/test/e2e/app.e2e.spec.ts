import request from 'supertest';

const API_URL = process.env.API_URL || 'http://localhost:3001';

const USER_A = {
  email: 'userA@example.com',
  password: 'Password123!',
};

async function login() {
  const res = await request(API_URL).post('/auth/login').send(USER_A);
  expect(res.status).toBe(201);
  expect(res.body.accessToken).toBeTruthy();
  return res.body.accessToken as string;
}

describe('REST E2E', () => {
  jest.setTimeout(30000);

  it('Login works', async () => {
    const token = await login();
    expect(token).toBeTruthy();
  });

  it('GET /rooms returns seeded rooms with unreadCount', async () => {
    const token = await login();
    const res = await request(API_URL)
      .get('/rooms')
      .set('authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
    expect(res.body[0]).toHaveProperty('unreadCount');
  });

  it('POST /rooms/:id/read updates cursor', async () => {
    const token = await login();
    const roomsRes = await request(API_URL)
      .get('/rooms')
      .set('authorization', `Bearer ${token}`);
    const roomId = roomsRes.body[0]._id;
    const messagesRes = await request(API_URL)
      .get(`/rooms/${roomId}/messages`)
      .set('authorization', `Bearer ${token}`);
    const first = messagesRes.body.items?.[0];
    const res = await request(API_URL)
      .post(`/rooms/${roomId}/read`)
      .set('authorization', `Bearer ${token}`)
      .send({
        lastReadMessageId: first?._id,
        lastReadAt: first?.createdAt,
      });
    expect(res.status).toBe(201);
  });

  it('Upload endpoint rejects invalid MIME', async () => {
    const token = await login();
    const roomsRes = await request(API_URL)
      .get('/rooms')
      .set('authorization', `Bearer ${token}`);
    const roomId = roomsRes.body[0]._id;
    const res = await request(API_URL)
      .post('/uploads')
      .set('authorization', `Bearer ${token}`)
      .field('roomId', roomId)
      .attach('file', Buffer.from('bad'), {
        filename: 'bad.exe',
        contentType: 'application/x-msdownload',
      });
    expect(res.status).toBe(400);
  });
});
