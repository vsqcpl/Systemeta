import { auth } from './src/lib/auth.ts';
const req = new Request('http://localhost:5000/api/auth/sign-in/email', {
  method: 'POST',
  headers: {'content-type': 'application/json', 'x-is-extended': 'true'},
  body: JSON.stringify({email: 'vivaan.mathur@vsqc.in', password: 'Vivaan@123'})
});
auth.handler(req).then(async res => {
  console.log('Status:', res.status);
  console.log('Body:', await res.text());
}).catch(console.error);
