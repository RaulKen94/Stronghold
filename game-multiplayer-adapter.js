/**
 * GAME-MULTIPLAYER-ADAPTER.JS
 * Adatta il gioco per supportare il multiplayer.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.supabase) return;

    /**
     * Avvia una partita multiplayer.
     */
    NS.startMultiplayerGame = async function(roomId, seed, localPlayerId, playersInfo, humanCount) {
        // Ordina i giocatori umani per joined_at
        const sortedHumanPlayers = [...playersInfo].sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));

        // Costruisce la configurazione dei giocatori
        const playerConfig = sortedHumanPlayers.map(p => ({
            name: p.player_name,
            isHuman: true,
            isLocal: p.id === localPlayerId,
            archetype: null,
            dbPlayerId: p.id          // UUID reale del giocatore
        }));

        // Completa con AI fino a 4
        const aiArchetypes = ['GENERAL', 'MERCHANT', 'ARCHITECT'];
        for (let i = playerConfig.length; i < 4; i++) {
            playerConfig.push({
                name: `PC ${i + 1}`,
                isHuman: false,
                isLocal: false,
                archetype: aiArchetypes[i % aiArchetypes.length],
                dbPlayerId: null
            });
        }

        const isHost = playersInfo.some(p => p.id === localPlayerId && p.is_host);

        // Crea il gioco
        const game = new NS.Game(seed, playerConfig, isHost);

        // ---------- GESTIONE ORDINE MOSSE ----------
        game.expectedSeq = 1;          // prossima seq da applicare
        game.moveBuffer = new Map();   // mappa seq -> mossa

        /**
         * Tenta di applicare le mosse in ordine.
         */
        function flushMoves() {
            while (game.moveBuffer.has(game.expectedSeq)) {
                const row = game.moveBuffer.get(game.expectedSeq);
                game.moveBuffer.delete(game.expectedSeq);
                game.applyRemoteMove(row.move_data);
                game.expectedSeq++;
            }
        }

        /**
         * Aggiunge una mossa al buffer (arrivata da Realtime o polling).
         */
        function pushMove(row) {
            if (!row || row.seq === undefined) return;
            if (row.seq < game.expectedSeq) return; // già applicata
            if (!game.moveBuffer.has(row.seq)) {
                game.moveBuffer.set(row.seq, row);
            }
            flushMoves();
        }

        // Callback per inviare una mossa
        game.sendMove = async (move) => {
            const player = game.players[move.player_id];
            const dbPlayerId = player ? player.dbPlayerId : null;
            alert('sendMove chiamato. Mossa: ' + JSON.stringify(move));
            try {
                const { error } = await NS.supabase.from('moves').insert([{
                    room_id: roomId,
                    player_id: dbPlayerId,   // UUID per umani, null per AI
                    move_data: move
                }]);
                if (error) {
                    alert('Errore Supabase: ' + error.message);
                }
            } catch (e) {
                alert('Eccezione invio mossa: ' + e.message);
            }
        };

        // Sottoscrizione Realtime alle mosse
        NS.subscribeToMoves(roomId, (payload) => {
            pushMove(payload.new);
        });

        // Polling di fallback: recupera le mosse mancanti
        const pollInterval = setInterval(async () => {
            try {
                // Chiedi le mosse con seq maggiore o uguale a expectedSeq
                const { data, error } = await NS.supabase
                    .from('moves')
                    .select('*')
                    .eq('room_id', roomId)
                    .gte('seq', game.expectedSeq)
                    .order('seq', { ascending: true });

                if (error) return;

                if (data && data.length > 0) {
                    data.forEach(row => pushMove(row));
                }
            } catch (e) {
                // ignora errori temporanei
            }
        }, 2000);
        
        alert('startMultiplayerGame avviato. RoomId: ' + roomId + ', Seed: ' + seed + ', localPlayerId: ' + localPlayerId + ', playersInfo: ' + JSON.stringify(playersInfo));
        window.game = game;

        document.getElementById('multiplayer-lobby').style.display = 'none';
        document.getElementById('main-menu').style.display = 'none';
    };

    /**
     * Sottoscrive alle mosse di una stanza.
     */
    NS.subscribeToMoves = function(roomId, callback) {
        return NS.supabase
            .channel('moves-' + roomId)
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'moves', filter: `room_id=eq.${roomId}` },
                (payload) => {
                    callback(payload);
                }
            )
            .subscribe();
    };
})();
