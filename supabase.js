// supabase.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://mllmvjaiaqdurbnqyonh.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_YJtWbi_UYBXqldQSE8pmmg_7JXexbfn';

export const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

console.log("✅ Supabase Client inizializzato");
