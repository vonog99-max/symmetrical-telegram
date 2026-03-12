import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL || 'https://jyofirfxwujmqvtudslg.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5b2ZpcmZ4d3VqbXF2dHVkc2xnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjMxMzIwNCwiZXhwIjoyMDg3ODg5MjA0fQ.TcHiGd0xuefzDRWuAxKF0W5MznYuUhw0nST0Nia6Q9s';

if (!supabaseUrl || !supabaseServiceKey) {
  console.warn('Supabase credentials missing. Persistence will be disabled.');
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function initSupabase() {
  if (!supabaseUrl || !supabaseServiceKey) return;

  // We can't easily create tables via JS SDK without custom functions or SQL execution
  // But we can check if they exist or just assume they do if the user set them up.
  // Since I have the service role key, I could potentially use an edge function or 
  // just rely on the fact that I'll be inserting data.
  
  console.log('Supabase initialized');
}
