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
    NS.createRoom = async function(playerName) {
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

        // Inserisci la stanza con human_count di default 2
        const { data: newRoom, error: roomError } = await NS.supabase
            .from('rooms')
            .insert([{ code, status: 'waiting', human_count: 2 }])
            .select()
            .single();
        if (roomError) throw roomError;
        const roomId = newRoom.id;
    
        // Inserisci il giocatore host
        const { data: playerData, error: playerInsertError } = await NS.supabase
            .from('players')
            .insert([{ room_id: roomId, player_name: playerName, is_host: true }])
            .select()
            .single();
        if (playerInsertError) throw playerInsertError;
    
        return { roomId, code, playerId: playerData.id };
    };
    

    /**
     * Aggiunge un giocatore a una stanza esistente tramite codice.
     */
    NS.joinRoom = async function(playerName, roomCode) {
        const { data: roomData, error: roomError } = await NS.supabase
            .from('rooms')
            .select('*')
            .eq('code', roomCode.trim().toUpperCase())
            .single();
        if (roomError) throw new Error('Stanza non trovata');
        if (roomData.status !== 'waiting') throw new Error('La stanza non è in attesa');
    
        // Controlla numero giocatori umani già presenti
        const { data: players, error: playersError } = await NS.supabase
            .from('players')
            .select('*')
            .eq('room_id', roomData.id);
        if (playersError) throw playersError;
        if (players.length >= roomData.human_count) throw new Error('Stanza piena (limite giocatori umani raggiunto)');
    
        const { data: playerData, error: insertError } = await NS.supabase
            .from('players')
            .insert([{ room_id: roomData.id, player_name: playerName, is_host: false }])
            .select()
            .single();
        if (insertError) throw insertError;
    
        return { roomId: roomData.id, code: roomData.code, playerId: playerData.id };
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
     * @param {function} onRoomStatusChanged - callback quando cambia lo stato della stanza
     * @returns {function} - funzione per annullare la sottoscrizione
     */
    NS.subscribeToRoom = function(roomId, onPlayerJoined, onMoveInserted, onRoomStatusChanged) {
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

        // Nuovo canale per i cambiamenti alla stanza
        const roomChannel = NS.supabase
            .channel('room-status-changes')
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `id=eq.${roomId}` },
                (payload) => {
                   if (onRoomStatusChanged) onRoomStatusChanged(payload.new);
                }
            )
            .subscribe();

        return () => {
            playersChannel.unsubscribe();
            movesChannel.unsubscribe();
            roomChannel.unsubscribe();
        };
    };

    /**
    * UPDATE ROOM HUMAN COUNT
    */
    NS.updateRoomHumanCount = async function(roomId, count) {
        if (count < 2 || count > 4) throw new Error('Numero non valido (min 2, max 4)');
        const { error } = await NS.supabase
            .from('rooms')
            .update({ human_count: count })
            .eq('id', roomId);
        if (error) throw error;
    };
    
    /**
     * Avvia la partita generando un seed casuale e salvandolo nella stanza.
     * @param {string} roomId - ID della stanza
     */
    NS.startRoom = async function(roomId) {
        // Genera un seed casuale (intero) per il PRNG del gioco
        const seed = Math.floor(Math.random() * 1000000);

        const { error } = await NS.supabase
            .from('rooms')
            .update({ status: 'playing', game_seed: seed })
            .eq('id', roomId);
        if (error) throw error;

        return seed;
    };

})();
