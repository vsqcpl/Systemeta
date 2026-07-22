import fs from "fs";
const orig = fs.readFileSync("original_page.tsx", "utf-8");
const curr = fs.readFileSync("app/(app)/billing/page.tsx", "utf-8");

function count(code: string) {
  let openBraces = 0;
  let openParens = 0;
  let openDivs = 0;
  for (let i = 0; i < code.length; i++) {
    if (code[i] === "{") openBraces++;
    if (code[i] === "}") openBraces--;
    if (code[i] === "(") openParens++;
    if (code[i] === ")") openParens--;
    if (code.slice(i, i + 4) === "<div") openDivs++;
    if (code.slice(i, i + 5) === "</div") openDivs--;
  }
  return { openBraces, openParens, openDivs };
}

console.log("Original:", count(orig));
console.log("Current:", count(curr));
