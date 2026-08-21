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

        game.pendingMoves = [];

        // Set per tenere traccia delle mosse già applicate
        game.appliedMoveIds = new Set();

        // Callback per inviare una mossa
        game.sendMove = async (move) => {
            // Aggiungi round e turno correnti alla mossa
            move.round = game.round;
            move.turn = game.currentPlayerIndex;
        
            const player = game.players[move.player_id];
            const dbPlayerId = player ? player.dbPlayerId : null;
        
            try {
                const { data, error } = await NS.supabase.from('moves').insert([{
                    room_id: roomId,
                    player_id: dbPlayerId,
                    move_data: move
                }]).select('id').single();
        
                if (error) {
                    alert('❌ Errore inserimento mossa: ' + error.message);
                    return;
                }
        
                if (data && data.id) {
                    game.appliedMoveIds.add(data.id);
                }
        
                alert('✅ Mossa inviata: ' + move.move_type);
                // Applica subito la mossa sull'host
                game.applyRemoteMove(move);
        
            } catch (e) {
                alert('❌ Eccezione inserimento mossa: ' + e.message);
            }
        };

        // Applica una mossa se non già applicata
        function applyMove(row) {
            if (!row || !row.move_data || game.appliedMoveIds.has(row.id)) return;
            game.appliedMoveIds.add(row.id);
        
            const move = row.move_data;
            const player = game.players[move.player_id];
            if (!player) return;
        
            // Le mosse di risoluzione (build_choice, stronghold_deposit) vanno sempre applicate subito
            if (move.move_type === 'build_choice' || move.move_type === 'stronghold_deposit') {
                alert('📩 Ricevuta mossa di risoluzione: ' + move.move_type + ' per ' + player.name);
                game.applyRemoteMove(move);
                return;
            }
        
            // Per le altre mosse, mantieni il controllo del turno
            if (move.player_id === game.currentPlayerIndex) {
                game.applyRemoteMove(move);
            } else {
                game.pendingMoves.push(move);
            }
        }

        // Sottoscrizione Realtime alle mosse
        NS.subscribeToMoves(roomId, (payload) => {
            applyMove(payload.new);
        });

        // Polling di fallback: controlla nuove mosse ogni 2 secondi
        const pollInterval = setInterval(async () => {
            try {
                const { data, error } = await NS.supabase
                    .from('moves')
                    .select('*')
                    .eq('room_id', roomId)
                    .order('created_at', { ascending: true });

                if (error) return;

                if (data && data.length > 0) {
                    data.forEach(row => applyMove(row));
                }
            } catch (e) {
                // ignora errori temporanei
            }
        }, 2000);

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
