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
})();
