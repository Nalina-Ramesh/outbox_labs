const configuredApiBaseUrl = process.env.NEXT_PUBLIC_API_URL?.replace(/\/+$/, '');

if (process.env.NODE_ENV === 'production' && !configuredApiBaseUrl) {
  throw new Error('NEXT_PUBLIC_API_URL must be set to the deployed backend URL.');
}

export const apiBaseUrl = configuredApiBaseUrl || 'http://localhost:4000';
