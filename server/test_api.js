async function main() {
  const res = await fetch("http://localhost:5000/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "admin@vsqc.com", password: "Admin123" })
  });
  console.log(res.status);
  const text = await res.text();
  console.log(text);
}
main();
