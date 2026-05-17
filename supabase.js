// supabase.js - Chiave di connessione centralizzata ed isolata
const SUPABASE_URL = "https://supabase.co";
const SUPABASE_KEY = "sb_publishable_VjCHbi_UYBXq1dQ5E8pmwg_7JXexbfn";

if (typeof supabase === 'undefined') {
    console.error("Errore Critico: SDK di Supabase non caricato nel DOM.");
}

// Esporta l'istanza corretta utilizzata da tutti gli altri script del SaaS
export const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
