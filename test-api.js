import http from 'http';

const req = http.request('http://localhost:3000/api/orders/cancel', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('3000 response:', res.statusCode, data));
});

req.on('error', err => console.log('3000 error:', err.message));
req.write('{}');
req.end();

const req2 = http.request('http://localhost:5173/api/orders/cancel', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('5173 response:', res.statusCode, data));
});

req2.on('error', err => console.log('5173 error:', err.message));
req2.write('{}');
req2.end();
