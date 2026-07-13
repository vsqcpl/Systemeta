const fs = require('fs');
function resolveTheirs(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(/<<<<<<< HEAD\r?\n[\s\S]*?=======\r?\n/g, '');
  content = content.replace(/>>>>>>> .*?\r?\n/g, '');
  fs.writeFileSync(filePath, content);
}
resolveTheirs('app/(app)/admin/page.tsx');
resolveTheirs('app/(app)/billing/page.tsx');
