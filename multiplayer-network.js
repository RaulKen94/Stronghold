/**
 * MULTIPLAYER-NETWORK.JS
 * Gestisce la comunicazione con Supabase per le stanze multiplayer.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.supabase) return;

    /**
     * Genera un codice stanza di 6 caratteri alfanumerici.
     */
    function generateRoomCode(length = 6) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }

    /**
     * Crea una nuova stanza e aggiunge il giocatore come host.
     */
    NS.createRoom = async function(playerName, maxPlayers = 4) {
        // Genera un codice univoco (controllo semplificato)
        let code;
        let roomData;
        do {
            code = generateRoomCode();
            const { data, error } = await NS.supabase
                .from('rooms')
                .select('id')
                .eq('code', code)
                .maybeSingle();
            if (error) throw error;
            roomData = data;
        } while (roomData);

        // Inserisci la stanza
        const { data: newRoom, error: roomError } = await NS.supabase
            .from('rooms')
            .insert([{ code, max_players: maxPlayers, status: 'waiting' }])
            .select()
            .single();
        if (roomError) throw roomError;
        const roomId = newRoom.id;

        // Inserisci il giocatore host
        const { error: playerError } = await NS.supabase
            .from('players')
            .insert([{ room_id: roomId, player_name: playerName, is_host: true }]);
        if (playerError) throw playerError;

        return { roomId, code };
    };

    /**
     * Aggiunge un giocatore a una stanza esistente tramite codice.
     */
    NS.joinRoom = async function(playerName, roomCode) {
        // Trova la stanza per codice
        const { data: roomData, error: roomError } = await NS.supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode.trim().toUpperCase())
            .single();
        if (roomError) throw new Error('Stanza non trovata');
        if (roomData.status !== 'waiting') throw new Error('La stanza non è in attesa');

        // Controlla numero giocatori
        const { data: players, error: playersError } = await NS.supabase
            .from('players')
            .select('*')
            .eq('room_id', roomData.id);
        if (playersError) throw playersError;
        if (players.length >= roomData.max_players) throw new Error('Stanza piena');

        // Inserisci il nuovo giocatore
        const { error: insertError } = await NS.supabase
            .from('players')
            .insert([{ room_id: roomData.id, player_name: playerName, is_host: false }]);
        if (insertError) throw insertError;

        return { roomId: roomData.id, code: roomData.code };
    };

    /**
     * Ritorna la lista dei giocatori di una stanza.
     */
    NS.getRoomPlayers = async function(roomId) {
        const { data, error } = await NS.supabase
            .from('players')
            .select('*')
            .eq('room_id', roomId);
        if (error) throw error;
        return data;
    };

    /**
     * Sottoscrive ai cambiamenti in tempo reale di una stanza.
     * @param {string} roomId - ID della stanza
     * @param {function} onPlayerJoined - callback quando un giocatore si unisce
     * @param {function} onMoveInserted - callback quando viene inserita una mossa
     * @returns {function} - funzione per annullare la sottoscrizione
     */
    NS.subscribeToRoom = function(roomId, onPlayerJoined, onMoveInserted) {
        const playersChannel = NS.supabase
            .channel('players-changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'players', filter: `room_id=eq.${roomId}` },
                (payload) => {
                    if (onPlayerJoined) onPlayerJoined(payload.new);
                }
            )
            .subscribe();

        const movesChannel = NS.supabase
            .channel('moves-changes')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'moves', filter: `room_id=eq.${roomId}` },
                (payload) => {
                    if (onMoveInserted) onMoveInserted(payload.new);
                }
            )
            .subscribe();

        return () => {
            playersChannel.unsubscribe();
            movesChannel.unsubscribe();
        };
    };
    
    /**
     * Imposta lo stato della stanza a 'playing'.
     * @param {string} roomId - ID della stanza
     */
    NS.startRoom = async function(roomId) {
        const { error } = await NS.supabase
            .from('rooms')
            .update({ status: 'playing' })
            .eq('id', roomId);
        if (error) throw error;
        return true;
    };

})();
