import http from 'http';

http.get('http://localhost:5173/api/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('5173:', res.statusCode, data));
}).on('error', err => console.error('5173 error:', err.message));

http.get('http://localhost:3000/api/health', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('3000:', res.statusCode, data));
}).on('error', err => console.error('3000 error:', err.message));
