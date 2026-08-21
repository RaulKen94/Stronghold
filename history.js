/**
 * HISTORY.JS
 * Gestisce lo storico strutturato delle azioni di gioco.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.Game) return;

    /**
     * Registra un'azione nello storico.
     * @param {object} entry - oggetto con i dettagli dell'azione
     */
    NS.Game.prototype.recordAction = function(entry) {
        if (!this.actionHistory) this.actionHistory = [];
        // Aggiungi automaticamente round, turno e nome giocatore se non presenti
        entry.round = entry.round !== undefined ? entry.round : this.round;
        entry.turn = entry.turn !== undefined ? entry.turn : this.currentPlayerIndex;
        const player = this.players.find(p => p.id === entry.player_id);
        entry.playerName = player ? player.name : `P${entry.player_id}`;
        this.actionHistory.push(entry);
    };

    /**
     * Restituisce lo storico delle azioni.
     * @returns {Array}
     */
    NS.Game.prototype.getActionHistory = function() {
        return this.actionHistory || [];
    };
})();
