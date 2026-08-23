/**
 * UTILS.JS
 * Funzioni di utilità generiche.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    /**
     * Generatore di numeri pseudocasuali deterministico (Mulberry32).
     * @param {number} seed - seme iniziale
     * @returns {function} - funzione che restituisce un numero in [0, 1)
     */
    NS.mulberry32 = function(seed) {
        var a = seed;
        return function() {
            a |= 0;
            a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    };

    /**
     * OPEN RULES MODAL
     * Carica dinamicamente il file rules.html dentro la modale info ed effettua lo switch di visualizzazione.
     */
    NS.openRulesModal = function() {
        const modal = document.getElementById('info-modal');
        const container = document.getElementById('rules-container');

        if (!modal || !container) return;

        // Se le regole sono già state caricate precedentemente, apre direttamente la modale
        if (container.dataset.loaded === "true") {
            modal.style.display = 'flex';
            return;
        }

        // Altrimenti effettua il fetch asincrono di rules.html
        fetch('rules.html')
            .then(response => {
                if (!response.ok) throw new Error('Impossibile caricare rules.html');
                return response.text();
            })
            .then(html => {
                container.innerHTML = html;
                container.dataset.loaded = "true";
                if (window.lucide) {
                    lucide.createIcons();
                }
                modal.style.display = 'flex';
            })
            .catch(err => {
                console.error('Errore nel caricamento delle regole:', err);
                container.innerHTML = '<p class="text-red-500 font-bold p-4">Errore durante il caricamento della guida.</p>';
                modal.style.display = 'flex';
            });
    };

    // Esposizione a livello globale per consentire la chiamata diretta onclick="openRulesModal()"
    window.openRulesModal = NS.openRulesModal;

})();
