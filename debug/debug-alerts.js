/**
 * DEBUG ALERTS
 * Aggiunge alert temporanei nei punti critici del multiplayer.
 * Da includere nell'index.html SOLO durante i test.
 */

(function() {
    if (!window.Roccaforte) return;

    // Patch di attemptClickSpace
    const origAttemptClickSpace = Roccaforte.Game.prototype.attemptClickSpace;
    Roccaforte.Game.prototype.attemptClickSpace = function(spaceId) {
        alert(`attemptClickSpace | Zona: ${spaceId} | Turno: ${this.players[this.currentPlayerIndex].name} | isLocal: ${this.players[this.currentPlayerIndex].isLocal} | passed: ${this.players[this.currentPlayerIndex].passed}`);
        return origAttemptClickSpace.call(this, spaceId);
    };

    // Patch di sendMove
    const origSendMoveSetup = Roccaforte.startMultiplayerGame;
    Roccaforte.startMultiplayerGame = async function(...args) {
        const result = await origSendMoveSetup.apply(this, args);
        const game = window.game;
        const origSendMove = game.sendMove;
        game.sendMove = async function(move) {
            alert(`sendMove chiamato | Mossa: ${JSON.stringify(move)}`);
            return origSendMove.call(game, move);
        };
        return result;
    };

    // Patch di applyRemoteMove
    const origApplyRemoteMove = Roccaforte.Game.prototype.applyRemoteMove;
    Roccaforte.Game.prototype.applyRemoteMove = function(move) {
        alert(`applyRemoteMove | Tipo: ${move.move_type} | Player: ${move.player_id} | Current: ${this.currentPlayerIndex}`);
        return origApplyRemoteMove.call(this, move);
    };
})();
