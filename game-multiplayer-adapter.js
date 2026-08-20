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

        // Inizializza il tracking delle mosse applicate
        game.appliedSeqSet = new Set();
        game.lastAppliedSeq = 0;

        // Callback per inviare una mossa
        game.sendMove = async (move) => {
            const player = game.players[move.player_id];
            const dbPlayerId = player ? player.dbPlayerId : null;

            try {
                const { error } = await NS.supabase.from('moves').insert([{
                    room_id: roomId,
                    player_id: dbPlayerId,
                    move_data: move
                }]);
                if (error) {
                    alert('Errore Supabase: ' + error.message);
                }
            } catch (e) {
                alert('Eccezione invio mossa: ' + e.message);
            }
        };

        // Funzione per applicare una mossa da un row (con seq)
        function applyMove(row) {
            if (!row || !row.seq) return;
            if (game.appliedSeqSet.has(row.seq)) return;

            game.appliedSeqSet.add(row.seq);
            game.lastAppliedSeq = Math.max(game.lastAppliedSeq, row.seq);

            game.applyRemoteMove(row.move_data);
        }

        // Sottoscrizione Realtime alle mosse
        NS.subscribeToMoves(roomId, (payload) => {
            applyMove(payload.new);
        });

        // Polling di fallback: ogni 2 secondi controlla eventuali mosse mancanti
        const pollInterval = setInterval(async () => {
            try {
                const { data, error } = await NS.supabase
                    .from('moves')
                    .select('*')
                    .eq('room_id', roomId)
                    .gt('seq', game.lastAppliedSeq)
                    .order('seq', { ascending: true });

                if (error) return;

                if (data && data.length > 0) {
                    data.forEach(row => applyMove(row));
                }
            } catch (e) {
                // ignora errori di rete temporanei
            }
        }, 2000);

        // Pulisce l'intervallo quando la partita termina? Non necessario per ora.

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
