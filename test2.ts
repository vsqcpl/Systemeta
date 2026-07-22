import fs from "fs";
const code = fs.readFileSync("original_page.tsx", "utf-8");
let openBraces = 0;
let lineNum = 1;
for (let i = 0; i < code.length; i++) {
  if (code[i] === "\n") lineNum++;
  if (code[i] === "{") openBraces++;
  if (code[i] === "}") openBraces--;
}
console.log("Original Final braces:", openBraces);
