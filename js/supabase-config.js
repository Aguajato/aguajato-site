// Configuração do Supabase usada pelo painel admin e pela página pública de laudos.
// Estas credenciais são públicas (anon key) — o acesso é controlado pelas
// Row Level Security policies definidas no banco.
window.AGUAJATO_SUPABASE = {
  url: 'https://tzbfzgutxmxpqirtudpn.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InR6YmZ6Z3V0eG14cHFpcnR1ZHBuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMjk3MjEsImV4cCI6MjA5NzgwNTcyMX0.I4lxzaZ3lC2RLxDLw9J-mLILndaIXsbMXYXfq5hdY14',
  table: 'aguajato_laudos',
  bucket: 'aguajato-laudos-pdfs'
};
