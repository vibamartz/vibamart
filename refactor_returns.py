import sys

with open('c:/Users/vk311/Downloads/viba-mart/src/pages/AdminDashboard.tsx', 'r', encoding='utf-8') as f:
    dashboard_content = f.read()

target = '''          {activeTab === 'returns' && (
            <AdminReturnsManagementView 
              returns={returns}
              onUpdateStatus={async (id, status, adminNotes) => {
                const idToken = await auth.currentUser?.getIdToken();
                const res = await fetch('/api/returns/update-status', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                  },
                  body: JSON.stringify({ returnId: id, status, adminNotes })
                });'''

replacement = '''          {activeTab === 'returns' && (
            <AdminReturnsManagementView 
              returns={returns}
              onUpdateStatus={async (id, status, adminNotes) => {
                const idToken = await auth.currentUser?.getIdToken();
                const res = await fetch('/api/requests/update-status', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                  },
                  body: JSON.stringify({ requestId: id, status, adminNotes })
                });'''

if target in dashboard_content:
    dashboard_content = dashboard_content.replace(target, replacement)
else:
    print("Failed to find target in AdminDashboard.tsx")

with open('c:/Users/vk311/Downloads/viba-mart/src/pages/AdminDashboard.tsx', 'w', encoding='utf-8') as f:
    f.write(dashboard_content)

print("SUCCESS AdminReturnsUpdate")
