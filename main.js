(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    // Test rapido: prova a leggere il numero di stanze
async function testSupabase() {
    const { data, error } = await window.Roccaforte.supabase
        .from('rooms')
        .select('*');
    if (error) {
        alert.error('Errore connessione Supabase:', error);
    } else {
        alert.log('Connessione Supabase OK! Stanze presenti:', data);
    }
}
testSupabase();
    
    // All'avvio mostra il menu principale (non parte subito una partita)
    window.showMainMenu();
    //OLD:window.game = new NS.Game();
    
})();
