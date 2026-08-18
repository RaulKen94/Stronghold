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

    // Esponi le funzioni globalmente per poterle usare negli attributi onclick
    window.showMainMenu = NS.showMainMenu;
    window.startSinglePlayerGame = NS.startSinglePlayerGame;
    window.openMultiplayerModal = NS.openMultiplayerModal;
    window.closeMultiplayerModal = NS.closeMultiplayerModal;
})();
