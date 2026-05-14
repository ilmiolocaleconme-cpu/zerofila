const SUPABASE_URL = "https://mllmvjaiaqdurbnqyonh.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sbG12amFpYXFkdXJibnF5b25oIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg3NjMzNjgsImV4cCI6MjA5NDMzOTM2OH0.RlSYvpx_hA27V7y2fTOBknf92LZeAjbARfcjActilyE";

const supabaseClient = supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);
