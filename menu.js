/**
 * MENU.JS
 * Gestisce il menu principale e la modale multiplayer.
 * Le funzioni sono esposte globalmente per essere usate dagli eventi onclick.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    /**
     * Mostra il menu principale a schermo intero.
     */
    NS.showMainMenu = function() {
        document.getElementById('main-menu').style.display = 'flex';
        document.getElementById('multiplayer-modal').style.display = 'none';
        // Se è aperta la modale di fine partita, la nascondiamo
        document.getElementById('end-modal').style.display = 'none';
    };

    /**
     * Nasconde il menu principale.
     */
    NS.hideMainMenu = function() {
        document.getElementById('main-menu').style.display = 'none';
    };

    /**
     * Avvia una partita in singolo contro 3 PC.
     */
    NS.startSinglePlayerGame = function() {
        NS.hideMainMenu();
        // Crea una nuova istanza di gioco e la rende globale
        window.game = new NS.Game();
    };

    /**
     * Apre la modale multiplayer.
     */
    NS.openMultiplayerModal = function() {
        document.getElementById('multiplayer-modal').style.display = 'flex';
    };

    /**
     * Chiude la modale multiplayer.
     */
    NS.closeMultiplayerModal = function() {
        document.getElementById('multiplayer-modal').style.display = 'none';
    };

    /**
     * Flusso per creare una stanza.
     */
    NS.createRoomFlow = async function() {
        let playerName = '';
        while (!playerName.trim()) {
            playerName = prompt('Inserisci il tuo nome:') || '';
            if (!playerName.trim()) alert('Il nome è obbligatorio');
        }
        try {
            const { roomId, code, playerId } = await NS.createRoom(playerName);
            NS.showLobby(roomId, code, playerName, true, playerId);
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    };

    /**
     * Flusso per partecipare a una stanza.
     */
    NS.joinRoomFlow = async function() {
        let playerName = '';
        while (!playerName.trim()) {
            playerName = prompt('Inserisci il tuo nome:') || '';
            if (!playerName.trim()) alert('Il nome è obbligatorio');
        }
        const roomCode = prompt('Inserisci il codice stanza:');
        if (!roomCode) return;
        try {
            const { roomId, code, playerId } = await NS.joinRoom(playerName, roomCode.trim().toUpperCase());
            NS.showLobby(roomId, code, playerName, false, playerId);
        } catch (e) {
            alert('Errore: ' + e.message);
        }
    };

    // Esponi le funzioni globalmente per poterle usare negli attributi onclick
    window.showMainMenu = NS.showMainMenu;
    window.startSinglePlayerGame = NS.startSinglePlayerGame;
    window.openMultiplayerModal = NS.openMultiplayerModal;
    window.closeMultiplayerModal = NS.closeMultiplayerModal;
    window.createRoomFlow = NS.createRoomFlow;
    window.joinRoomFlow = NS.joinRoomFlow;
})();
