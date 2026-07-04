import { auth } from './src/lib/auth.js';

async function testSignIn() {
  try {
    const response = await auth.api.signInEmail({
      body: { email: 'admin@vsqc.com', password: 'Admin123' },
      asResponse: true
    });
    console.log("Status:", response.status);
    const text = await response.text();
    console.log("Response:", text);
  } catch (error) {
    console.error("Error:", error);
  }
}
testSignIn();
