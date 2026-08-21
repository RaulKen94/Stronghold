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
     * @param {string} playerId - ID del giocatore
     */
    NS.showLobby = async function(roomId, roomCode, playerName, isHost, playerId) {
        document.getElementById('main-menu').style.display = 'none';
        document.getElementById('multiplayer-modal').style.display = 'none';

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

        const title = document.createElement('h2');
        title.className = 'fantasy-font text-2xl mb-4';
        title.textContent = 'Stanza ' + roomCode;
        lobbyDiv.appendChild(title);

        // Contenitore giocatori
        const playersContainer = document.createElement('div');
        playersContainer.id = 'lobby-players-list';
        playersContainer.className = 'flex flex-col gap-2 w-64';
        lobbyDiv.appendChild(playersContainer);

        // Variabili condivise tra i blocchi
        let currentHumanCount = 2;  // verrà aggiornata se host
        let playersList = [];
        let startBtn = null;        // pulsante avvia, se host

        // Funzione di aggiornamento pulsante Avvia
        function updateStartButton() {
            if (!startBtn) return;
            const ready = playersList.length >= currentHumanCount;
            startBtn.disabled = !ready;
            startBtn.className = 'bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded mt-4' +
                                 (ready ? '' : ' opacity-50 cursor-not-allowed');
        }

        // Controllo umani (solo host)
        if (isHost) {
            const humanControl = document.createElement('div');
            humanControl.className = 'flex items-center gap-2 bg-slate-800 p-2 rounded';
            humanControl.innerHTML = `
                <span class="text-sm">Giocatori umani:</span>
                <button id="btn-dec-humans" class="bg-slate-600 hover:bg-slate-500 text-white font-bold px-2 py-1 rounded">-</button>
                <span id="human-count-display" class="font-bold">2</span>
                <button id="btn-inc-humans" class="bg-slate-600 hover:bg-slate-500 text-white font-bold px-2 py-1 rounded">+</button>
            `;
            lobbyDiv.appendChild(humanControl);

            // Lettura human_count attuale
            const { data: roomData } = await NS.supabase
                .from('rooms')
                .select('human_count')
                .eq('id', roomId)
                .single();
            if (roomData) currentHumanCount = roomData.human_count;
            document.getElementById('human-count-display').textContent = currentHumanCount;

            document.getElementById('btn-dec-humans').onclick = async () => {
                if (currentHumanCount <= 2) return;
                currentHumanCount--;
                await NS.updateRoomHumanCount(roomId, currentHumanCount);
                document.getElementById('human-count-display').textContent = currentHumanCount;
                updateStartButton();
            };
            document.getElementById('btn-inc-humans').onclick = async () => {
                if (currentHumanCount >= 4) return;
                currentHumanCount++;
                await NS.updateRoomHumanCount(roomId, currentHumanCount);
                document.getElementById('human-count-display').textContent = currentHumanCount;
                updateStartButton();
            };
        }

        const backBtn = document.createElement('button');
        backBtn.textContent = 'Indietro';
        backBtn.className = 'bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 px-4 rounded mt-4';
        backBtn.onclick = () => {
            if (unsubscribe) unsubscribe();
            lobbyDiv.style.display = 'none';
            window.showMainMenu();
        };
        lobbyDiv.appendChild(backBtn);

        if (isHost) {
            startBtn = document.createElement('button');
            startBtn.textContent = 'Avvia partita';
            startBtn.className = 'bg-green-600 hover:bg-green-500 text-white font-bold py-2 px-4 rounded mt-4';
            startBtn.disabled = true; // verrà abilitato da updateStartButton
            startBtn.onclick = async () => {
                if (!confirm('Vuoi avviare la partita?')) return;
                try {
                    await NS.startRoom(roomId);
                } catch (e) {
                    alert('Errore avvio partita: ' + e.message);
                }
            };
            lobbyDiv.appendChild(startBtn);
        }

        let localPlayerId = playerId;

        async function refreshPlayers() {
            const players = await NS.getRoomPlayers(roomId);
            playersList = players;
            playersContainer.innerHTML = '';
            players.forEach(p => {
                const div = document.createElement('div');
                div.className = 'bg-slate-800 p-2 rounded text-center';
                div.textContent = (p.is_host ? '👑 ' : '') + p.player_name;
                playersContainer.appendChild(div);
            });
            updateStartButton();
        }

        var unsubscribe = NS.subscribeToRoom(
            roomId,
            (newPlayer) => { refreshPlayers(); },
            (newMove) => { /* per ora ignora */ },
            (updatedRoom) => {
                if (updatedRoom.status === 'playing') {
                    const seed = updatedRoom.game_seed;
                    if (seed === undefined || seed === null) {
                        alert('Errore: seed non disponibile');
                        return;
                    }
                    if (unsubscribe) unsubscribe();
                    lobbyDiv.style.display = 'none';

                    // Ottieni i giocatori aggiornati dal DB
                    NS.getRoomPlayers(roomId).then(players => {
                        const humanCount = updatedRoom.human_count;
                        NS.startMultiplayerGame(roomId, seed, localPlayerId, players, humanCount);
                    });
                }
            }
        );

        await refreshPlayers();
    };

})();
