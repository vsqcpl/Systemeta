const http = require("http");
const options = {
  hostname: "localhost",
  port: 3000,
  path: "/api/timesheets/punch-sessions?employeeId=all",
  method: "GET",
};
const req = http.request(options, (res) => {
  let data = "";
  res.on("data", (chunk) => data += chunk);
  res.on("end", () => console.log(data.substring(0, 500)));
});
req.on("error", (e) => console.error(e));
req.end();
