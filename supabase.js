// supabase.js - Chiave di connessione centralizzata ed isolata
const SUPABASE_URL = "https://mllmvjaiaqdurbnqyonh.supabase.co";
const SUPABASE_KEY = "sb_publishable_YJtWbi_UYBXqldQSE8pmmg_7JXexbfn";

if (typeof supabase === 'undefined') {
    console.error("Errore Critico: SDK di Supabase non caricato nel DOM.");
}

// Esporta l'istanza corretta utilizzata da tutti gli altri script del SaaS
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
