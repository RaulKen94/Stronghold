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
     */
    NS.startMultiplayerGame = async function(roomId, seed, localPlayerId, playersInfo) {
        // Costruisce la configurazione dei giocatori
        const playerConfig = playersInfo.map(p => ({
            name: p.player_name,
            isHuman: true,          // tutti umani per ora
            isLocal: p.id === localPlayerId,
            archetype: null
        }));

        // Crea il gioco con seed e configurazione
        const game = new NS.Game(seed, playerConfig);

        // Imposta il callback di invio mosse
        game.sendMove = async (move) => {
            try {
                await NS.supabase.from('moves').insert([{
                    room_id: roomId,
                    player_id: localPlayerId,
                    move_data: move
                }]);
            } catch (e) {
                alert('Invio mossa fallito: ' + e.message);
            }
        };

        // Rende il gioco globale per compatibilità
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
