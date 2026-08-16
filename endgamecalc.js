(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    /**
     * Calcola i punteggi finali della partita e li scompone nei singoli componenti.
     * @param {Game} game - istanza del gioco
     * @returns {Array} - array di oggetti score ordinati per totale decrescente
     */
    NS.calculateEndGameScores = function(game) {
        const players = game.players;
        const firstPlayerIndex = game.firstPlayerIndex;
        
        let scores = players.map(p => {
            // --- BASE ---
            let baseVp = p.vp;
            let baseFirst = (firstPlayerIndex === p.id) ? 3 : 0;
            let baseResidence = p.hasResidence ? 6 : 0;
            let base = baseVp + baseFirst + baseResidence;

            // --- RISORSE ---
            let resBase = Math.floor((p.coin + p.wood + p.brick) / 3);
            let resCattle = Math.floor(p.cattle / 2);
            let resLuxury = p.luxury;
            let res = resBase + resCattle + resLuxury;

            // --- FORTEZZA BASE ---
            let fortBInf = Math.floor(p.stronghold.infantry / 3);
            let fortBArc = Math.floor(p.stronghold.archer / 2);
            let fortBKni = p.stronghold.knight;
            let fortBase = fortBInf + fortBArc + fortBKni;

            // --- SET / TRUPPE FUORI ---
            let outPairs = Math.floor((p.infantry + p.archer) / 2);
            let outKni = p.knight;
            let troopOut = outPairs + outKni;

            return {
                p,
                base,
                baseVp,
                baseFirst,
                baseResidence,
                res,
                resBase,
                resCattle,
                resLuxury,
                fortBase,
                fortBInf,
                fortBArc,
                fortBKni,
                fortMaj: 0,
                fortMInf: 0,
                fortMArc: 0,
                fortMKni: 0,
                outMaj: 0,
                outMInf: 0,
                troopOut,
                outPairs,
                outKni,
                total: 0
            };
        });

        // Maggioranze in fortezza
        const applyMaj = (prop, pts) => { 
            let max = Math.max(...scores.map(s => s.p.stronghold[prop])); 
            if (max > 0) {
                scores.filter(s => s.p.stronghold[prop] === max).forEach(s => {
                    s.fortMaj += pts;
                    if (prop === 'infantry') s.fortMInf = pts;
                    if (prop === 'archer') s.fortMArc = pts;
                    if (prop === 'knight') s.fortMKni = pts;
                });
            }
        };
        applyMaj('infantry', 7); 
        applyMaj('archer', 7); 
        applyMaj('knight', 10);
        
        // Maggioranza unità fuori (solo fanteria)
        let maxOutInf = Math.max(...scores.map(s => s.p.infantry)); 
        if (maxOutInf > 0) {
            scores.filter(s => s.p.infantry === maxOutInf).forEach(s => {
                s.outMaj += 7;
                s.outMInf = 7;
            });
        }
        
        // Calcolo totale e ordinamento
        scores.forEach(s => s.total = s.base + s.fortBase + s.fortMaj + s.outMaj + s.troopOut + s.res);
        scores.sort((a, b) => b.total - a.total || b.p.brick - a.p.brick);
        
        return scores;
    };
})();
