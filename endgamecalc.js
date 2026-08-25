/**
 * ======================================================
 * ENDGAMECALC.JS - v1.9.0
 * ======================================================
 * Calcolo dei punteggi finali della partita e scomposizione
 * nei singoli componenti (con supporto a 1° e 2° posto nelle maggioranze,
 * punti base OutBase per truppe e legno fuori e tracciamento tipo di maggioranza).
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    /**
     * Helper per la renderizzazione delle celle con badge per le maggioranze
     * @param {number} val - Punti Vittoria ottenuti
     * @param {string|null} type - Tipo di maggioranza ('solo1' | 'tie1' | 'solo2' | 'tie2' | null)
     * @returns {string} - Stringa HTML della cella <td>
     */
    NS.renderMajorityCell = function(val, type) {
        if (!val || !type) return `<td class="p-2">0</td>`;
        
        const isTie = type.startsWith('tie');
        const place = type.endsWith('1') ? '1°' : '2°';
        const badgeClass = isTie ? 'bg-red-600' : 'bg-emerald-600';
        const titleText = `${place} Posto ${isTie ? 'Pari Merito' : 'Solitario'}`;

        return `<td class="relative p-2 font-bold text-center">
            <span>${val}</span>
            <span class="absolute bottom-0.5 right-0.5 ${badgeClass} text-white text-[8px] px-1 rounded-full font-bold shadow-xs" title="${titleText}">${place}</span>
        </td>`;
    };

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
            // 1 VP ogni 2 Fanti, 2 VP per Arciere, 4 VP per Cavaliere
            let fortBInf = Math.floor(p.stronghold.infantry / 2);
            let fortBArc = p.stronghold.archer * 2;
            let fortBKni = p.stronghold.knight * 4;
            let fortBase = fortBInf + fortBArc + fortBKni;

            // --- TRUPPE E LEGNO FUORI (OutBase) ---
            // 1 VP ogni 4 elementi (fanti+arcieri+cavalieri+legno) + 1 VP cad. per Arcieri e Cavalieri fuori
            let totalOutItems = p.infantry + p.archer + p.knight + p.wood;
            let outBaseGroup = Math.floor(totalOutItems / 4);
            let outBaseArc = p.archer;
            let outBaseKni = p.knight;
            let outBase = outBaseGroup + outBaseArc + outBaseKni;

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
                fortMInfType: null,
                fortMArcType: null,
                fortMKniType: null,
                outMaj: 0,
                outMInf: 0,
                outMInfType: null,
                outBaseGroup,
                outBaseArc,
                outBaseKni,
                outBase,
                troopOut: outBase, // Alias di retrocompatibilità
                total: 0
            };
        });

        // ----------------------------------------------------
        // MAGGIORANZE IN ROCCAFORTE (1° e 2° posto + Parità)
        // ----------------------------------------------------
        const applyMaj = (prop, pts1, pts2, tie1, tie2) => {
            // Estrazione valori per ciascun giocatore
            const values = scores.map(s => ({ scoreObj: s, val: s.p.stronghold[prop] }));
            const max1 = Math.max(...values.map(v => v.val));

            const typeProp = prop === 'infantry' ? 'fortMInfType' : (prop === 'archer' ? 'fortMArcType' : 'fortMKniType');

            if (max1 > 0) {
                const firstPlace = values.filter(v => v.val === max1);
                
                if (firstPlace.length > 1) {
                    // Parità al 1° posto (nessun 2° posto assegnato)
                    firstPlace.forEach(v => {
                        v.scoreObj.fortMaj += tie1;
                        v.scoreObj[typeProp] = 'tie1';
                        if (prop === 'infantry') v.scoreObj.fortMInf = tie1;
                        if (prop === 'archer') v.scoreObj.fortMArc = tie1;
                        if (prop === 'knight') v.scoreObj.fortMKni = tie1;
                    });
                } else {
                    // 1° posto solitario
                    const firstWinner = firstPlace[0];
                    firstWinner.scoreObj.fortMaj += pts1;
                    firstWinner.scoreObj[typeProp] = 'solo1';
                    if (prop === 'infantry') firstWinner.scoreObj.fortMInf = pts1;
                    if (prop === 'archer') firstWinner.scoreObj.fortMArc = pts1;
                    if (prop === 'knight') firstWinner.scoreObj.fortMKni = pts1;

                    // Calcolo 2° posto tra i rimanenti con valore > 0
                    const remaining = values.filter(v => v.val < max1 && v.val > 0);
                    if (remaining.length > 0) {
                        const max2 = Math.max(...remaining.map(v => v.val));
                        const secondPlace = remaining.filter(v => v.val === max2);

                        const isSecondTie = (secondPlace.length > 1);
                        const ptsSecond = isSecondTie ? tie2 : pts2;
                        const secondType = isSecondTie ? 'tie2' : 'solo2';

                        secondPlace.forEach(v => {
                            v.scoreObj.fortMaj += ptsSecond;
                            v.scoreObj[typeProp] = secondType;
                            if (prop === 'infantry') v.scoreObj.fortMInf += ptsSecond;
                            if (prop === 'archer') v.scoreObj.fortMArc += ptsSecond;
                            if (prop === 'knight') v.scoreObj.fortMKni += ptsSecond;
                        });
                    }
                }
            }
        };

        // Fanteria: 1° (7), 2° (4) | Parità 1° (5), Parità 2° (4)
        applyMaj('infantry', 7, 4, 5, 4);
        // Arcieri: 1° (9), 2° (5) | Parità 1° (7), Parità 2° (5)
        applyMaj('archer', 9, 5, 7, 5);
        // Cavalieri: 1° (12), 2° (6) | Parità 1° (9), Parità 2° (6)
        applyMaj('knight', 12, 6, 9, 6);
        
        // ----------------------------------------------------
        // MAGGIORANZA UNITA' FUORI (Solo Fanteria, Prerequisito: >= 1 Fante in Roccaforte)
        // ----------------------------------------------------
        const eligibleOut = scores.filter(s => (s.p.stronghold.infantry || 0) >= 1);
        if (eligibleOut.length > 0) {
            const outValues = eligibleOut.map(s => ({ scoreObj: s, val: s.p.infantry }));
            const maxOut1 = Math.max(...outValues.map(v => v.val));

            if (maxOut1 > 0) {
                const firstOut = outValues.filter(v => v.val === maxOut1);

                if (firstOut.length > 1) {
                    // Parità 1° posto fuori: 4 PV a ciascuno
                    firstOut.forEach(v => {
                        v.scoreObj.outMaj += 4;
                        v.scoreObj.outMInf = 4;
                        v.scoreObj.outMInfType = 'tie1';
                    });
                } else {
                    // 1° posto solitario fuori: 6 PV
                    const winnerOut = firstOut[0];
                    winnerOut.scoreObj.outMaj += 6;
                    winnerOut.scoreObj.outMInf = 6;
                    winnerOut.scoreObj.outMInfType = 'solo1';

                    // 2° posto fuori tra i rimanenti idonei
                    const remOut = outValues.filter(v => v.val < maxOut1 && v.val > 0);
                    if (remOut.length > 0) {
                        const maxOut2 = Math.max(...remOut.map(v => v.val));
                        const secondOut = remOut.filter(v => v.val === maxOut2);
                        
                        const isSecondTie = (secondOut.length > 1);
                        const secondType = isSecondTie ? 'tie2' : 'solo2';

                        // Solitario o Parità 2° posto fuori: 3 PV
                        secondOut.forEach(v => {
                            v.scoreObj.outMaj += 3;
                            v.scoreObj.outMInf += 3;
                            v.scoreObj.outMInfType = secondType;
                        });
                    }
                }
            }
        }
        
        // Calcolo totale e ordinamento
        scores.forEach(s => s.total = s.base + s.fortBase + s.fortMaj + s.outMaj + s.outBase + s.res);
        scores.sort((a, b) =>
            b.total - a.total ||
            b.p.brick - a.p.brick ||
            b.p.wood - a.p.wood ||
            b.p.coin - a.p.coin ||
            b.p.initialTurnOrder - a.p.initialTurnOrder
        );
        
        return scores;
    };
})();
