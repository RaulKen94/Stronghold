/**
 * ======================================================
 * AI.JS - v1.5.3
 * ======================================================
 * Gestione avanzata dell'Intelligenza Artificiale (Eurogame AI):
 * - Gestione avanzata iniziativa e Primo Giocatore (Punto 2: min R5, max R6-7)
 * - Fasi di gioco bilanciate EARLY/MID/LATE (Punto 3: crescita senza ossessione Cantiere)
 * - Prevenzione degli sprechi di risorse in LATE game (Punto 4)
 * - Pianificazione tattica truppe e Roccaforte con conoscenza limitata eventi R+1 (Punto 6)
 * - Simulazione matematica per il deposito fanti basata su maggioranze (7 VP)
 *   e punti unità sia dentro che fuori dalla Fortezza.
 * - Gerarchia di urgenza Nuvole Dappertutto (R6-7): Roccaforte > Accampamento > Taverna/Militari.
 * - Piano B dinamico se la Roccaforte è inaccessibile (ottimizzazione Fanti Fuori per i 7 VP
 *   comparata a Palazzo e Punti Vittoria diretti).
 * ======================================================
 */

(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.Game) return;

    // ============ METODI DELL'IA ============

    /**
     * CHOOSE AI STRONGHOLD DEPOSIT
     * Calcola il numero di fanti k da depositare simulando il punteggio totale netto
     * sia dentro che fuori dalla Fortezza (maggioranze da 7 VP e conversioni unità).
     */
    NS.Game.prototype.chooseAIStrongholdDeposit = function(p) {
        if (!p.infantry || p.infantry <= 0) return 0;

        const archersInHand = p.archer || 0;
        const knightsInHand = p.knight || 0;
        const opponents = this.players.filter(pl => pl.id !== p.id);

        let bestK = 0;
        let maxNetVP = -999;

        // Simulazione per ogni possibile quantità k di fanti versati (da 0 a p.infantry)
        for (let k = 0; k <= p.infantry; k++) {
            // Stato DENTRO simulato (Arcieri e Cavalieri in mano passano automaticamente dentro)
            const simInfantryInside = (p.stronghold.infantry || 0) + k;
            const simArchersInside = (p.stronghold.archer || 0) + archersInHand;
            const simKnightsInside = (p.stronghold.knight || 0) + knightsInHand;

            // Stato FUORI simulato (Residuo in mano)
            const simInfantryOutside = p.infantry - k;
            const simArchersOutside = 0; // Passati dentro
            const simKnightsOutside = 0; // Passati dentro

            // ----------------------------------------------------
            // 1. CALCOLO PUNTEGGIO DENTRO LA FORTEZZA
            // ----------------------------------------------------
            let infInsideRank = 1;
            let archInsideRank = 1;
            let kniInsideRank = 1;

            opponents.forEach(opp => {
                if ((opp.stronghold.infantry || 0) >= simInfantryInside) infInsideRank++;
                if ((opp.stronghold.archer || 0) >= simArchersInside) archInsideRank++;
                if ((opp.stronghold.knight || 0) >= simKnightsInside) kniInsideRank++;
            });

            // Maggioranze dentro (7 VP al 1° posto, 0 altrimenti)
            let vpInsideMaj = 0;
            if (infInsideRank === 1) vpInsideMaj += 7;
            if (archInsideRank === 1) vpInsideMaj += 7;
            if (kniInsideRank === 1) vpInsideMaj += 7;

            // Punti Unità dentro (1 VP ogni 3 Fanti, 1 VP ogni 2 Arcieri, 1 VP per Cavaliere)
            const vpInsideUnits = Math.floor(simInfantryInside / 3) + 
                                  Math.floor(simArchersInside / 2) + 
                                  simKnightsInside;

            // ----------------------------------------------------
            // 2. CALCOLO PUNTEGGIO FUORI DALLA FORTEZZA
            // ----------------------------------------------------
            // Maggioranza Fanti Fuori (7 VP al 1° posto, 0 altrimenti)
            let infOutsideRank = 1;
            opponents.forEach(opp => {
                if ((opp.infantry || 0) >= simInfantryOutside) infOutsideRank++;
            });

            let vpOutsideMaj = 0;
            if (infOutsideRank === 1) vpOutsideMaj += 7;

            // Punti Unità fuori (1 VP ogni 2 unità tra Fanti ed Arcieri, 1 VP per Cavaliere)
            const vpOutsideUnits = Math.floor((simInfantryOutside + simArchersOutside) / 2) + 
                                   simKnightsOutside;

            // ----------------------------------------------------
            // 3. SALDO NETTO E SCELTA DELL'OTTIMO
            // ----------------------------------------------------
            const totalVP = vpInsideMaj + vpInsideUnits + vpOutsideMaj + vpOutsideUnits;

            if (totalVP > maxNetVP) {
                maxNetVP = totalVP;
                bestK = k;
            }
        }

        return bestK;
    };

    /**
     * AI MOVE
     * Decide la mossa migliore per il giocatore AI basandosi su euristica avanzata.
     */
    NS.Game.prototype.aiMove = function(p) {
        let stage = 'EARLY';
        if (this.round >= 3 && this.round <= 5) stage = 'MID';
        else if (this.round >= 6) stage = 'LATE';
    
        let maxScore = -1;
        let leaderId = -1;
        this.players.forEach(pl => {
            let s = this.calculateProjectedScore(pl);
            if (s > maxScore) {
                maxScore = s;
                leaderId = pl.id;
            }
        });
        const amIWinning = (leaderId === p.id);

        // Controllo eventi attuali e imminenti (R e R+1 - conoscenza limitata)
        const isNuvoleCurrent = (this.currentEvent?.id === 'nuvole');
        const nextRoundIdx = this.round; // Indice per R+1 nella coda
        const nextEvent = (nextRoundIdx < this.maxRounds && this.eventQueue) ? this.eventQueue[nextRoundIdx] : null;
        const isNuvoleNext = nextEvent && nextEvent.id === 'nuvole';
        const isCarestiaNext = nextEvent && nextEvent.id === 'famine';

        const isNuvoleActiveOrImminent = (stage === 'LATE') && (isNuvoleCurrent || isNuvoleNext);
        const isStrongholdBlocked = this.watchtowerBlocked || this.lockedSpaces.includes(2);

        let opts = [];

        // 1. VALUTAZIONE TECNOLOGIE
        if (!p.techUsed) {
            this.currentTechs.forEach((t, i) => {
                if (t.takenBy === null) {
                    let techScore = 10;
                    if (t.id === 1 && (stage === 'EARLY' || p.maxWorkers < 4)) techScore += 50;
                    else if (t.id === 1 && stage === 'LATE') techScore = 0;
                    
                    // Iniziativa / Primo Giocatore (Punto 2)
                    if (t.id === 18 || (t.text && t.text.includes('👑'))) {
                        if (this.round === 5) techScore += 8;
                        if (stage === 'LATE') techScore += 28;
                    }

                    opts.push({ type: 'tech', idx: i, score: techScore });
                }
            });
        }
    
        // 2. VALUTAZIONE CASELLE DI GIOCO
        this.spaces.forEach(s => {
            if (this.lockedSpaces.includes(s.id)) return;
            if (s.id === 2 && this.watchtowerBlocked) return;
            if (s.type === 'blue') return;
            if (s.uniquePlayer && s.slotsOccupied.includes(p.id)) return;
            if (s.slots !== 99 && s.slotsOccupied.length >= s.slots) return;
            if (this.gognaTarget === p.id && (s.type === 'mil' || s.id === 2)) return;
    
            let wc = s.cost.workerCost || 1;
            let coinCost = s.cost.coin || 0;
            if (s.ownerId !== undefined && s.ownerId !== p.id) coinCost += 1;
            if (this.currentEvent?.id === 'war' && s.type === 'mil') coinCost = Math.max(0, coinCost - 1);
    
            let brickCost = s.cost.brick || 0;
            if (s.id === 17) brickCost += this.cantiereInflation;
    
            if (p.workers >= wc && p.coin >= coinCost &&
                (!s.cost.wood || p.wood >= s.cost.wood) &&
                (p.brick >= brickCost) &&
                (!s.cost.cattle || p.cattle >= s.cost.cattle)) {
    
                let score = 5 + this.rng() * 10;

                // Iniziativa / Primo Giocatore (Punto 2)
                if (s.id === 201 || s.id === 18) {
                    if (this.round === 5) score += 6;
                    if (stage === 'LATE') score += 30;
                }

                // Fasi di gioco bilanciate (Punto 3)
                if (stage === 'EARLY') {
                    if (s.id === 12) score += 30;
                    if (s.reward && (s.reward.cattle || s.reward.coin)) score += 10;
                } else if (stage === 'MID') {
                    if (s.reward && (s.reward.wood || s.reward.brick)) score += 8;
                } else if (stage === 'LATE') {
                    if (s.type === 'vp') score += 25;
                    if (s.id === 8 && p.luxury > 0) score += 25 * p.luxury; // Palazzo
                    if (s.type === 'mil') score += 20;
                    if (s.id === 12) score -= 20;
                }

                // Prevenzione spreco risorse (Punto 4)
                if (stage === 'LATE') {
                    const hasTimeToBuild = (this.round < this.maxRounds) || (p.workers > 1);
                    if (s.reward && (s.reward.wood || s.reward.brick) && !s.reward.vp) {
                        if (!hasTimeToBuild || (p.hasResidence && p.brick < 3)) {
                            score -= 15;
                        }
                    }
                }

                // ----- GERARCHIA D'URGENZA E PIANO B (Punto 6) -----
                if (isNuvoleActiveOrImminent) {
                    if (!isStrongholdBlocked && (s.id === 2 || s.name?.includes('Roccaforte'))) {
                        // MASSIMA PRIORITÀ ASSOLUTA: Entrare per primi in Roccaforte
                        score += 60;
                    } else if (s.id === 7 || s.name?.includes('Accampamento')) {
                        // Prima Battuta: Accampamento (conversione immediata risorse/truppe/VP)
                        score += 42;
                    } else if (s.id === 13 || s.name?.includes('Taverna')) {
                        // Seconda Battuta: Taverna
                        score += 32;
                    } else if (s.type === 'mil') {
                        // Edifici Militari generici
                        score += 26;
                    }
                }

                // PIANO B: Se la Roccaforte è bloccata o inaccessibile
                if (stage === 'LATE' && isStrongholdBlocked) {
                    // Valuta se reclutare truppe per la maggioranza Fanti FUORI (+7 VP)
                    if (s.type === 'mil') {
                        let maxOpponentOutsideInfantry = 0;
                        this.players.forEach(pl => {
                            if (pl.id !== p.id && pl.infantry > maxOpponentOutsideInfantry) {
                                maxOpponentOutsideInfantry = pl.infantry;
                            }
                        });
                        // Se siamo vicini a soffiare la maggioranza esterna, spingi sulle truppe
                        if (p.infantry + 1 >= maxOpponentOutsideInfantry) {
                            score += 30;
                        }
                    }
                }

                // Carestia imminente
                if (isCarestiaNext) {
                    if (s.id === 14 || s.id === 15) score -= 10;
                }

                // Archetipi
                if (p.archetype === 'GENERAL') {
                    if (s.type === 'mil') score += 15;
                    if (s.id === 7 && stage !== 'EARLY') score += 15;
                }
    
                if (p.archetype === 'MERCHANT') {
                    if (s.id === 14 || s.id === 15 || s.id === 16) score += 12;
                    if (s.reward && s.reward.coin) score += 5;
                }
    
                if (p.archetype === 'ARCHITECT') {
                    if (s.reward && (s.reward.wood || s.reward.brick)) score += 10;
                    if (s.id === 17 && stage !== 'LATE') score += 12;
                }
    
                if (s.id === 201 && this.accumulatedCoinsPorta > 2) score += 20;
    
                if (!amIWinning && stage === 'LATE') {
                    if (s.type === 'vp') score += 15;
                }
    
                opts.push({ type: 'space', id: s.id, score: score });
            }
        });
    
        if (opts.length === 0) {
            this.passTurn();
            return;
        }
    
        opts.sort((a, b) => b.score - a.score);
        const best = opts[0];
    
        let success = false;
        if (best.type === 'tech') success = this.executeTech(p, best.idx);
        else success = this.executeAction(p, best.id);

        if (!success) {
            console.warn(`AI ${p.name} failed move.`);
            this.passTurn();
        }
    };
    
    /**
     * CALCULATE PROJECTED SCORE
     * Stima il punteggio di un giocatore per la valutazione dell'IA.
     */
    NS.Game.prototype.calculateProjectedScore = function(p) {
        let score = p.vp;
        score += Math.floor(p.stronghold.infantry / 3);
        score += Math.floor(p.stronghold.archer / 2);
        score += p.stronghold.knight;
        if (p.hasResidence) score += 6;
        return score;
    };

    /**
     * APPLY SPECIAL REWARD AI
     * Gestisce gli effetti speciali specifici per l'IA.
     */
    NS.Game.prototype.applySpecialRewardAI = function(type, p, spaceId) {
        if (type === 'piazza') {
            if (this.rng() > 0.5) {
                p.wood++;
                return 'Piazza (AI): +1 Legno';
            } else {
                p.brick++;
                return 'Piazza (AI): +1 Mattone';
            }
        } else if (type === 'monastero') {
            p.wood++;
            return 'Monastero (AI): +1 Legno';
        } else if (type === 'taverna') {
            p.infantry++;
            p.vp++;
            return 'Taverna (AI): +1 Fante +1 VP';
        } else if (type === 'accampamento') {
            if (p.wood > 0) {
                p.wood--;
                p.vp++;
                p.infantry++;
                return 'Accampamento (AI): 1 Legno → 1 VP +1 Fante';
            }
            return 'Accampamento (AI): nessuna azione (manca Legno)';
        } else if (type === 'gogna') {
            const target = this.players.find(pl => pl.id !== p.id && pl.id !== spaceId.ownerId);
            if (target) {
                this.gognaTarget = target.id;
                return `Gogna (AI): ${target.name}`;
            }
            return 'Gogna (AI): nessuna vittima valida';
        }
        return '';
    };

    /**
     * CHOOSE AI BUILD
     */
    NS.Game.prototype.chooseAIBuild = function(p) {
        if (!p.hasResidence && p.luxury >= 1) {
            return NS.NEW_BUILDINGS.find(x => x.type === 'blue');
        }
        const avail = NS.NEW_BUILDINGS.filter(x => x.type !== 'blue' && !this.builtBuildings.includes(x.id));
        if (avail.length > 0) {
            const rand = this.rng();
            const chosen = avail[Math.floor(rand * avail.length)];
            return chosen;
        }
        return null;
    };
    
})();
