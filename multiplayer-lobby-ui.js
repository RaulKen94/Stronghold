/**
 * MULTIPLAYER-LOBBY-UI.JS
 * Mostra la sala d'attesa di una stanza multiplayer.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.supabase) return;

    /**
     * Mostra la lobby di una stanza.
     * @param {string} roomId - ID della stanza
     * @param {string} roomCode - Codice pubblico della stanza
     * @param {string} playerName - Nome del giocatore locale
     * @param {boolean} isHost - Indica se il giocatore è host
     */
    NS.showLobby = async function(roomId, roomCode, playerName, isHost) {
        // Nascondi menu e modale
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('multiplayer-modal').style.display = 'none';

        // Crea o riusa il contenitore della lobby
        let lobbyDiv = document.getElementById('multiplayer-lobby');
        if (!lobbyDiv) {
            lobbyDiv = document.createElement('div');
            lobbyDiv.id = 'multiplayer-lobby';
            lobbyDiv.style.cssText =
                'position:fixed; inset:0; background:#0f172a; color:white; z-index:4000; ' +
                'display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px;';
            document.body.appendChild(lobbyDiv);
        }
        lobbyDiv.style.display = 'flex';
        lobbyDiv.innerHTML = '';

        // Titolo con codice stanza
        const title = document.createElement('h2');
        title.className = 'fantasy-font text-2xl mb-4';
        title.textContent = 'Stanza ' + roomCode;
        lobbyDiv.appendChild(title);

        // Lista giocatori
        const playersContainer = document.createElement('div');
        playersContainer.id = 'lobby-players-list';
        playersContainer.className = 'flex flex-col gap-2 w-64';
        lobbyDiv.appendChild(playersContainer);

        // Pulsante Indietro
        const backBtn = document.createElement('button');
        backBtn.textContent = 'Indietro';
        backBtn.className = 'bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded mt-4';
        backBtn.onclick = () => {
            if (unsubscribe) unsubscribe();
            lobbyDiv.style.display = 'none';
            window.showMainMenu();
        };
        lobbyDiv.appendChild(backBtn);

        // Se l'host, mostra il pulsante Avvia partita
        if (isHost) {
            const startBtn = document.createElement('button');
            startBtn.textContent = 'Avvia partita';
            startBtn.className = 'bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded mt-4';
            startBtn.onclick = async () => {
                if (!confirm('Vuoi avviare la partita?')) return;
                try {
                    await NS.startRoom(roomId);
                    // Non facciamo nulla qui: la Realtime callback si occuperà di avviare la partita
                } catch (e) {
                    alert('Errore avvio partita: ' + e.message);
                }
            };
            lobbyDiv.appendChild(startBtn);
        }

        // Funzione per aggiornare la lista giocatori
        async function refreshPlayers() {
            const players = await NS.getRoomPlayers(roomId);
            playersContainer.innerHTML = '';
            players.forEach(p => {
                const div = document.createElement('div');
                div.className = 'bg-slate-800 p-2 rounded text-center';
                div.textContent = (p.is_host ? '👑 ' : '') + p.player_name;
                playersContainer.appendChild(div);
            });
        }

        // Sottoscrivi ai cambiamenti (nuovi giocatori, mosse)
        var unsubscribe = NS.subscribeToRoom(
            roomId,
            (newPlayer) => { refreshPlayers(); },
            (newMove) => { /* per ora ignora */ },
            (updatedRoom) => {
                if (updatedRoom.status === 'playing') {
                    // La partita è iniziata
                    if (unsubscribe) unsubscribe();
                    lobbyDiv.style.display = 'none';
                    alert('La partita è iniziata!');
                    // In Fase 4 avvieremo il gioco vero e proprio
                    // Per ora mostriamo solo il menu
                    window.showMainMenu();
                }
            }
        );

        // Carica iniziale della lista
        await refreshPlayers();
    };
})();
