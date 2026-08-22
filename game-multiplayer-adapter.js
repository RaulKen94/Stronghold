/**
 * GAME-MULTIPLAYER-ADAPTER.JS
 * Adatta il gioco per supportare il multiplayer.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.supabase) return;

    // Riferimenti globali per gestire il ciclo di vita di canali e polling
    let pollInterval = null;
    let activeMovesChannel = null;

    /**
     * Ferma eventuale polling attivo.
     */
    function stopPolling() {
        if (pollInterval) {
            clearInterval(pollInterval);
            pollInterval = null;
        }
    }

    /**
     * Ferma e rimuove eventuale canale Realtime attivo.
     */
    function removeActiveChannel() {
        if (activeMovesChannel) {
            try {
                activeMovesChannel.unsubscribe();
                activeMovesChannel.removeChannel();
            } catch (e) {
                console.warn('Errore rimozione canale Realtime:', e);
            }
            activeMovesChannel = null;
        }
    }

    /**
     * Avvia una partita multiplayer.
     */
    NS.startMultiplayerGame = async function(roomId, seed, localPlayerId, playersInfo, humanCount) {
        // Ferma polling e canale Realtime precedenti (se esistenti)
        stopPolling();
        removeActiveChannel();

        // Recupera il codice stanza
        const { data: roomData, error: roomError } = await NS.supabase
            .from('rooms')
            .select('code')
            .eq('id', roomId)
            .single();
        if (roomError) throw roomError;

        const localPlayer = playersInfo.find(p => p.id === localPlayerId);
        const playerName = localPlayer ? localPlayer.player_name : 'Giocatore';
        const isHost = localPlayer ? localPlayer.is_host : false;

        // Salva i dati della lobby per permettere il ritorno alla stessa stanza
        NS.currentLobbyData = {
            roomId,
            roomCode: roomData.code,
            playerName,
            isHost,
            playerId: localPlayerId
        };

        // Ordina i giocatori umani per joined_at
        const sortedHumanPlayers = [...playersInfo].sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));

        // Costruisce la configurazione dei giocatori
        const playerConfig = sortedHumanPlayers.map(p => ({
            name: p.player_name,
            isHuman: true,
            isLocal: p.id === localPlayerId,
            archetype: null,
            dbPlayerId: p.id
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

        // Crea il gioco
        const game = new NS.Game(seed, playerConfig, isHost);

        game.pendingMoves = [];
        game.appliedMoveIds = new Set();

        // Callback per inviare una mossa
        game.sendMove = async (move) => {
            const clientMoveId = (typeof crypto !== 'undefined' && crypto.randomUUID)
                ? crypto.randomUUID()
                : Date.now() + '-' + Math.random();

            game.appliedMoveIds.add(clientMoveId);
            move.client_move_id = clientMoveId;
            move.round = game.round;
            move.turn = game.currentPlayerIndex;

            const player = game.players[move.player_id];
            const dbPlayerId = player ? player.dbPlayerId : null;

            try {
                const { data, error } = await NS.supabase.from('moves').insert([{
                    id: clientMoveId,
                    room_id: roomId,
                    player_id: dbPlayerId,
                    move_data: move
                }]).select('id').single();

                if (error) {
                    alert('Errore inserimento mossa: ' + error.message);
                    game.appliedMoveIds.delete(clientMoveId);
                    return;
                }

                game.applyRemoteMove(move);
            } catch (e) {
                alert('Eccezione inserimento mossa: ' + e.message);
                game.appliedMoveIds.delete(clientMoveId);
            }
        };

        // Applica una mossa se non già applicata
        function applyMove(row) {
            if (!row || !row.move_data || game.appliedMoveIds.has(row.id)) return;
            game.appliedMoveIds.add(row.id);

            const move = row.move_data;
            const player = game.players[move.player_id];
            if (!player) return;

            if (move.move_type === 'build_choice' || move.move_type === 'stronghold_deposit') {
                game.applyRemoteMove(move);
                return;
            }

            if (move.player_id === game.currentPlayerIndex) {
                game.applyRemoteMove(move);
            } else {
                if (!game.pendingMoves.some(m => m.client_move_id === move.client_move_id)) {
                    game.pendingMoves.push(move);
                }
            }
        }

        // Sottoscrizione Realtime (salvata per poterla rimuovere in futuro)
        activeMovesChannel = NS.subscribeToMoves(roomId, (payload) => {
            applyMove(payload.new);
        });

        // Polling di fallback
        pollInterval = setInterval(async () => {
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
     * TORNA ALLA LOBBY DELLA STESSA STANZA
     */
    NS.returnToLobby = function() {
        const data = NS.currentLobbyData;
        if (!data) return;

        // Ferma polling e canale Realtime attivi
        stopPolling();
        removeActiveChannel();

        const endModal = document.getElementById('end-modal');
        if (endModal) endModal.style.display = 'none';

        // Se il giocatore è host, riporta la stanza in waiting
        const resetPromise = data.isHost
            ? NS.resetRoomToWaiting(data.roomId)
            : Promise.resolve();

        resetPromise.then(() => {
            NS.showLobby(data.roomId, data.roomCode, data.playerName, data.isHost, data.playerId);
        }).catch(e => {
            alert('Errore nel tornare alla lobby: ' + e.message);
        });
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

    // Esponi globalmente la funzione per l'uso nell'HTML
    window.returnToLobby = NS.returnToLobby;
})();
