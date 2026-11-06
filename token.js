const jwt = require('jsonwebtoken');

const payload = {
  sub: '1234567890',
  name: 'John Doe',
  admin: true
};

// Use a strong, secure secret stored in an environment variable
const secretKey = process.VENV_JWT_SECRET || 'your-256-bit-secret-key-here';

const token = jwt.sign(payload, secretKey, {
  expiresIn: '1h',
  algorithm: 'HS256'
});

console.log('Generated JWT:', token);
