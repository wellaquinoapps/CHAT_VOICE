# PrivateLine - Supabase + React PWA

## Configuração na Vercel (Environment Variables)

Ao importar o repositório na **Vercel** (`https://vercel.com`), adicione as seguintes variáveis em **Settings > Environment Variables**:

| Nome da Variável | Valor | Finalidade |
| :--- | :--- | :--- |
| `VITE_SUPABASE_URL` | `https://btabaezzpxqgffaubvmd.supabase.co` | Conexão do Frontend com Supabase |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0YWJhZXp6cHhxZ2ZmYXVidm1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQwNDcyNzEsImV4cCI6MjEwOTYyMzI3MX0.UKAP8QDzKPmlqlxPFGAzPbKpQWu-GlUNZ21sIfWE_MY` | Chave pública anônima do Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJ0YWJhZXp6cHhxZ2ZmYXVidm1kIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5NDA0NzI3MSwiZXhwIjoyMTA5NjIzMjcxfQ.ik0bq_Qd2RoTAUQ3tHhlx_zsZxtqO7tGu7pzUKTuJpU` | Usada com segurança pela Serverless Function da Vercel (`api/register-child.js`) para cadastrar os filhos |
| `VITE_VAPID_PUBLIC_KEY` | `BC0aFbvJ7pvyHEh8gth0Y5grOUXkEMGgKyDN1ouBMA-nVgNKx85ZUIAt7P-Xuv1PxiVCqxzHzgVwpVcUd0rXH7w` | Chave pública do Web Push |

## Build settings na Vercel
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Install Command:** `npm install`

