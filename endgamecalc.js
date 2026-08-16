(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    /**
     * Calcola i punteggi finali della partita.
     * @param {Game} game - istanza del gioco
     * @returns {Array} - array di oggetti score ordinati per totale decrescente
     */
    NS.calculateEndGameScores = function(game) {
        const players = game.players;
        const firstPlayerIndex = game.firstPlayerIndex;
        
        let scores = players.map(p => {
            let base = p.vp;
            let fortInf = Math.floor(p.stronghold.infantry / 3);
            let fortArc = Math.floor(p.stronghold.archer / 2);
            let fortKni = p.stronghold.knight;
            let fortBase = fortInf + fortArc + fortKni;
            
            let outPairs = Math.floor((p.infantry + p.archer) / 2);
            let outKni = p.knight;
            let troopOut = outPairs + outKni;

            let res = p.luxury + Math.floor(p.cattle/2) + Math.floor((p.coin+p.wood+p.brick)/3);
            if(firstPlayerIndex === p.id) base += 3;
            if(p.hasResidence) base += 6;
            return { p, base, fortBase, fortMaj: 0, outMaj: 0, troopOut, res, total: 0 };
        });

        // Maggioranze in fortezza
        const applyMaj = (prop, pts) => { 
            let max = Math.max(...scores.map(s => s.p.stronghold[prop])); 
            if(max > 0) scores.filter(s => s.p.stronghold[prop] === max).forEach(s => s.fortMaj += pts); 
        };
        applyMaj('infantry', 7); 
        applyMaj('archer', 7); 
        applyMaj('knight', 10);
        
        // Maggioranza unità fuori (solo fanteria)
        let maxOutInf = Math.max(...scores.map(s => s.p.infantry)); 
        if(maxOutInf > 0) scores.filter(s => s.p.infantry === maxOutInf).forEach(s => s.outMaj += 7);
        
        // Calcolo totale e ordinamento
        scores.forEach(s => s.total = s.base + s.fortBase + s.fortMaj + s.outMaj + s.troopOut + s.res);
        scores.sort((a,b) => b.total - a.total || b.p.brick - a.p.brick);
        
        return scores;
    };
})();