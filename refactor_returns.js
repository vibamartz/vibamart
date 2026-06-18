const fs = require('fs');

async function runRefactor() {
  let dashboard_content = fs.readFileSync('c:/Users/vk311/Downloads/viba-mart/src/pages/AdminDashboard.tsx', 'utf-8');

  const target = `          {activeTab === 'returns' && (
            <AdminReturnsManagementView 
              returns={returns}
              onUpdateStatus={async (id, status, adminNotes) => {
                const idToken = await auth.currentUser?.getIdToken();
                const res = await fetch('/api/returns/update-status', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${idToken}\`
                  },
                  body: JSON.stringify({ returnId: id, status, adminNotes })
                });`;

  const replacement = `          {activeTab === 'returns' && (
            <AdminReturnsManagementView 
              returns={returns}
              onUpdateStatus={async (id, status, adminNotes) => {
                const idToken = await auth.currentUser?.getIdToken();
                const res = await fetch('/api/requests/update-status', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': \`Bearer \${idToken}\`
                  },
                  body: JSON.stringify({ requestId: id, status, adminNotes })
                });`;

  if (dashboard_content.includes(target)) {
    dashboard_content = dashboard_content.replace(target, replacement);
  } else {
    console.log('Could not find ' + 'target');
  }

  fs.writeFileSync('c:/Users/vk311/Downloads/viba-mart/src/pages/AdminDashboard.tsx', dashboard_content);

}

runRefactor();
