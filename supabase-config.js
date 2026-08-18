/**
 * SUPABASE CONFIG
 * Inizializza il client Supabase con l'URL del progetto e la chiave pubblica.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    const SUPABASE_URL = 'https://bldixvaiagpluqzsjjtc.supabase.co';
    const SUPABASE_ANON_KEY = 'sb_publishable_wGiGDr1LCSJst7gv-tngfQ_CAEAnr1B';

    NS.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
})();
