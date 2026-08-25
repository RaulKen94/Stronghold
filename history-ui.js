/**
 * HISTORY-UI.JS
 * Mostra graficamente lo storico delle azioni.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    /**
     * Renderizza la history nel contenitore specificato.
     * @param {Array} history - lista delle azioni
     * @param {string} containerId - ID del contenitore (default: action-history-list)
     */
    NS.renderActionHistory = function(history, containerId = 'action-history-list') {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!history || history.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500">Nessuna azione registrata.</p>';
        return;
    }

    const getIcon = (type) => {
        if (type === 'build') return '🏗️ ';
        if (type === 'stronghold') return '🏰 ';
        if (type === 'special') return '✨ ';
        if (type === 'pass') return '💤 ';
        if (type === 'tech') return '📜 ';
        return '';
    };

    container.innerHTML = history.map((entry, i) => {
        const playerName = entry.playerName || `P${entry.player_id}`;
        const desc = entry.desc || entry.type;
        const roundLabel = `R${entry.round}`;
        const icon = getIcon(entry.type);
        return `<div class="flex justify-between text-xs py-0.5 border-b border-slate-200">
            <span class="font-mono text-slate-500">#${i+1}</span>
            <span class="flex-1 px-2">${icon}${playerName}: ${desc}</span>
            <span class="text-slate-400">${roundLabel} T${entry.turn}</span>
        </div>`;
    }).join('');
};
})();
