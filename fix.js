const fs = require('fs');
let c = fs.readFileSync('dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx', 'utf8');
c = c.replace(/\\'/g, "'");
fs.writeFileSync('dashboard/src/components/enrollment/EnrollmentBillingDetailModal.jsx', c);
