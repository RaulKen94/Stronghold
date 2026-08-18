(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    /*
    async function testSupabase() {
        if (!NS.supabase) {
            alert('Supabase non inizializzato. Controlla supabase-config.js');
            return;
        }
        const { data, error } = await NS.supabase
            .from('rooms')
            .select('*');
        if (error) {
            alert('Errore connessione Supabase: ' + JSON.stringify(error));
        } else {
            alert('Connessione Supabase OK! Stanze presenti: ' + JSON.stringify(data));
        }
    }

    // Esegui il test e poi mostra il menu
    testSupabase().finally(() => {*/
        window.showMainMenu();
    //});
})();
