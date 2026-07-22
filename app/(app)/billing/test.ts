import fs from "fs";

const code = fs.readFileSync("page.tsx", "utf-8");
let openBraces = 0;
let lineNum = 1;
for (let i = 0; i < code.length; i++) {
  if (code[i] === "\n") lineNum++;
  if (code[i] === "{") openBraces++;
  if (code[i] === "}") openBraces--;
}
console.log("Open braces:", openBraces);

let openParens = 0;
for (let i = 0; i < code.length; i++) {
  if (code[i] === "(") openParens++;
  if (code[i] === ")") openParens--;
}
console.log("Open parens:", openParens);

let openDivs = 0;
for (let i = 0; i < code.length; i++) {
  if (code.slice(i, i + 4) === "<div") openDivs++;
  if (code.slice(i, i + 5) === "</div") openDivs--;
}
console.log("Open divs:", openDivs);

