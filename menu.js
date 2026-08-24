/**
 * ======================================================
 * MENU.JS - v1.2.0
 * ======================================================
 * Gestisce il menu principale, il caricamento/rendering delle statistiche e la modale multiplayer.
 * Le chiamate Supabase sono isolate per evitare blocchi nell'avvio della partita Single Player.
 * ======================================================
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    // Stato globale in memoria per le statistiche
    NS.gameStats = NS.gameStats || null;

    /**
     * Renderizza il box grafico delle statistiche nel menu principale.
     */
    NS.renderStatsUI = function() {
        const menuContainer = document.getElementById('main-menu');
        if (!menuContainer) return;

        let statsCard = document.getElementById('stats-card-container');
        if (!statsCard) {
            statsCard = document.createElement('div');
            statsCard.id = 'stats-card-container';
            statsCard.className = 'stats-card';
            menuContainer.appendChild(statsCard);
        }

        const stats = NS.gameStats || {
            singleplayer_count: 0,
            mp_2p_count: 0,
            mp_3p_count: 0,
            mp_4p_count: 0
        };

        const mpTotal = (stats.mp_2p_count || 0) + (stats.mp_3p_count || 0) + (stats.mp_4p_count || 0);

        statsCard.innerHTML = `
            <div class="stats-title">Statistiche di Gioco</div>
            <div class="stats-row">
                <span>⚔️ Partite Single Player:</span>
                <span class="stats-val-group">${stats.singleplayer_count || 0}</span>
            </div>
            <div class="stats-row mt-2">
                <span>🌐 Partite Multiplayer:</span>
                <span class="stats-val-group">${mpTotal}</span>
            </div>
            <div class="stats-sub-container">
                <div class="stats-sub-row">
                    <span>2 Giocatori:</span>
                    <span class="stats-val-group"><span>${stats.mp_2p_count || 0}</span><span class="text-xs">👤👤</span></span>
                </div>
                <div class="stats-sub-row">
                    <span>3 Giocatori:</span>
                    <span class="stats-val-group"><span>${stats.mp_3p_count || 0}</span><span class="text-xs">👤👤👤</span></span>
                </div>
                <div class="stats-sub-row">
                    <span>4 Giocatori:</span>
                    <span class="stats-val-group"><span>${stats.mp_4p_count || 0}</span><span class="text-xs">👤👤👤👤</span></span>
                </div>
            </div>
        `;
    };

    /**
     * Mostra il menu principale a schermo intero e carica le statistiche se non in memoria.
     */
    NS.showMainMenu = async function() {
        document.getElementById('main-menu').style.display = 'flex';
        document.getElementById('multiplayer-modal').style.display = 'none';
        document.getElementById('end-modal').style.display = 'none';

        // Carica le statistiche dal DB soltanto la prima volta (1 sola SELECT protetta)
        if (!NS.gameStats && NS.supabase) {
            try {
                const { data, error } = await NS.supabase
                    .from('game_stats')
                    .select('*')
                    .eq('id', 1)
                    .maybeSingle();

                if (!error && data) {
                    NS.gameStats = data;
                }
            } catch (e) {
                console.warn('Lettura game_stats ignorata:', e.message);
            }
        }

        // Renderizza la grafica usando i dati in memoria
        NS.renderStatsUI();
    };

    /**
     * Nasconde il menu principale.
     */
    NS.hideMainMenu = function() {
        document.getElementById('main-menu').style.display = 'none';
    };

    /**
     * Avvia una partita in singolo contro 3 PC.
     * Garantisce l'inizializzazione della plancia anche in caso di errori di rete.
     */
    NS.startSinglePlayerGame = function() {
        NS.hideMainMenu();

        // 1. Aggiornamento ottimistico in memoria RAM locale
        if (NS.gameStats) {
            NS.gameStats.singleplayer_count = (NS.gameStats.singleplayer_count || 0) + 1;
        }

        // 2. Incremento atomico asincrono non bloccante sul DB
        if (NS.supabase && typeof NS.supabase.rpc === 'function') {
            Promise.resolve().then(async () => {
                try {
                    await NS.supabase.rpc('increment_game_stat', { stat_name: 'singleplayer' });
                } catch (e) {
                    console.warn('Incremento DB Single Player non riuscito:', e.message);
                }
            });
        }

        // 3. Creazione immediata dell'istanza di gioco
        try {
            window.game = new NS.Game();
        } catch (err) {
            console.error('Errore durante la creazione del gioco:', err);
            alert('Errore durante l\'avvio della partita: ' + err.message);
        }
    };

    /**
     * Apre la modale multiplayer.
     */
    NS.openMultiplayerModal = function() {
        document.getElementById('multiplayer-modal').style.display = 'flex';
    };

    /**
     * Chiude la modale multiplayer.
     */
    NS.closeMultiplayerModal = function() {
        document.getElementById('multiplayer-modal').style.display = 'none';
    };

    /**
     * Flusso per creare una stanza.
     */
    NS.createRoomFlow = async function() {
        let playerName = '';
        while (!playerName.trim()) {
            playerName = prompt('Inserisci il tuo nome:') || '';
            if (!playerName.trim()) alert('Il nome è obbligatorio');
        }
        try {
            const { roomId, code, playerId } = await NS.createRoom(playerName);
            NS.showLobby(roomId, code, playerName, true, playerId);
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    };

    /**
     * Flusso per partecipare a una stanza.
     */
    NS.joinRoomFlow = async function() {
        let playerName = '';
        while (!playerName.trim()) {
            playerName = prompt('Inserisci il tuo nome:') || '';
            if (!playerName.trim()) alert('Il nome è obbligatorio');
        }
        const roomCode = prompt('Inserisci il codice stanza:');
        if (!roomCode) return;
        try {
            const { roomId, code, playerId } = await NS.joinRoom(playerName, roomCode.trim().toUpperCase());
            NS.showLobby(roomId, code, playerName, false, playerId);
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    };

    // Esponi le funzioni globalmente per gli attributi onclick
    window.showMainMenu = NS.showMainMenu;
    window.startSinglePlayerGame = NS.startSinglePlayerGame;
    window.openMultiplayerModal = NS.openMultiplayerModal;
    window.closeMultiplayerModal = NS.closeMultiplayerModal;
    window.createRoomFlow = NS.createRoomFlow;
    window.joinRoomFlow = NS.joinRoomFlow;
})();
