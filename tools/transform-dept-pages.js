/* Transform civil-department.html and electrical.html for Step 2.7 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function transform(file, dept, loginPrefix) {
  let s = fs.readFileSync(path.join(root, file), 'utf8');

  s = s.replace(/<style>[\s\S]*?<\/style>/, [
    '<link rel="stylesheet" href="assets/empire.css">',
    '<link rel="stylesheet" href="assets/empire-dept.css">'
  ].join('\n'));

  if (!s.includes('assets/empire-core.js')) {
    s = s.replace(
      '<div class="modal" id="imgModal"',
      '<script src="config.js"></script>\n<script src="assets/empire-api.js"></script>\n<script src="assets/empire-core.js"></script>\n<div class="modal" id="imgModal"'
    );
  }

  // Remove duplicated theme / sidebar / dialog bootstrap
  s = s.replace(
    /\/\* ===== Theme \(light default \+ dark toggle, remembered\) ===== \*\/[\s\S]*?window\.alert=function\(m\)\{ window\.uiAlert\(m\); \};\n\}\)\(\);\n/,
    ''
  );

  s = s.replace(
    /const GS = '[^']+';\nconst LOADING_HTML = '[^']+';\n/,
    ''
  );

  s = s.replace(
    /function fetchJSONRetry\(body, tries\)\{[\s\S]*?\}\n/,
    ''
  );

  s = s.replace(/\bGS\b/g, 'GOOGLE_SCRIPT_URL');

  const loginRe = new RegExp(
    'function handleLogin\\(e\\)\\{[\\s\\S]*?\\n\\}',
    'm'
  );

  s = s.replace(loginRe,
    "function handleLogin(e){\n" +
    "  e.preventDefault();\n" +
    "  var u=document.getElementById('loginUsername').value;\n" +
    "  var p=document.getElementById('loginPassword').value;\n" +
    "  var m=document.getElementById('loginMessage');\n" +
    "  empireLogin({username:u,password:p,dept:'" + dept + "',messageEl:m}).then(function(d){\n" +
    "    localStorage.setItem('" + loginPrefix + "_loggedIn','true');\n" +
    "    localStorage.setItem('" + loginPrefix + "_user',u);\n" +
    "    localStorage.setItem('" + loginPrefix + "_token',d.token||'');\n" +
    "    localStorage.setItem('" + loginPrefix + "_perms',JSON.stringify(d.perms||{}));\n" +
    "    localStorage.setItem('" + loginPrefix + "_role',d.role||'');\n" +
    "    enterApp();\n" +
    "  });\n" +
    "}\n"
  );

  fs.writeFileSync(path.join(root, file), s, 'utf8');
  const lines = s.split('\n').length;
  console.log('Updated', file, '-', lines, 'lines');
}

transform('civil-department.html', 'civil department', 'civdept');
transform('electrical.html', 'electrical department', 'eldept');

console.log('Done');
