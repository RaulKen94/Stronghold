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
     * @param {string} roomId - ID della stanza
     * @param {number} seed - seed per il PRNG
     * @param {number} localPlayerId - ID del giocatore locale
     * @param {Array} playersInfo - array di oggetti {id, player_name, is_host}
     * @param {number} humanCount - count giocatori umani
     */
    NS.startMultiplayerGame = async function(roomId, seed, localPlayerId, playersInfo, humanCount) {
        // Costruisce la configurazione dei giocatori
        // Ordina i giocatori umani per joined_at
        const sortedHumanPlayers = playersInfo.sort((a, b) => new Date(a.joined_at) - new Date(b.joined_at));
        const playerConfig = sortedHumanPlayers.map(p => ({
            name: p.player_name,
            isHuman: true,
            isLocal: p.id === localPlayerId,
            archetype: null
        }));
    
        // Completa con AI fino a 4
        const aiArchetypes = ['GENERAL', 'MERCHANT', 'ARCHITECT'];
        for (let i = playerConfig.length; i < 4; i++) {
            playerConfig.push({
                name: `PC ${i+1}`,
                isHuman: false,
                isLocal: false,
                archetype: aiArchetypes[i % aiArchetypes.length]
            });
        }
    
        // Determina se questo client è l'host
        const isHost = playersInfo.some(p => p.id === localPlayerId && p.is_host);
    
        // Crea il gioco con seed, configurazione e flag isHost
        const game = new NS.Game(seed, playerConfig, isHost);

        // Imposta il callback di invio mosse
        game.sendMove = async (move) => {
            try {
                const { error } = await NS.supabase.from('moves').insert([{
                    room_id: roomId,
                    player_id: move.player_id,   // al momento errato: UUID vs intero
                    move_data: move
                }]);
                if (error) {
                    alert('Errore Supabase: ' + error.message);
                    return;
                }
            } catch (e) {
                alert('Eccezione invio mossa: ' + e.message);
            }
        };
    
        // Rende il gioco globale
        window.game = game;
    
        // Nascondi lobby e menu
        document.getElementById('multiplayer-lobby').style.display = 'none';
        document.getElementById('main-menu').style.display = 'none';
    
        // Sottoscrizione alle mosse
        NS.subscribeToMoves(roomId, (move) => {
            game.applyRemoteMove(move.move_data);
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
                    callback(payload.new);
                }
            )
            .subscribe();
    };
})();
