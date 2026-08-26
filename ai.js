/**
 * ======================================================
 * AI.JS - v1.7.1
 * ======================================================
 * Gestione avanzata dell'Intelligenza Artificiale (Eurogame AI):
 * - Gestione avanzata iniziativa e Primo Giocatore (Punto 2)
 * - Fasi di gioco bilanciate EARLY/MID/LATE
 * - Prevenzione sprechi risorse in LATE game
 * - Simulazione matematica deposito fanti sincronizzata con NS.MAJORITY_CONFIG:
 *   - Valori base dentro: Fante=0.5, Arciere=2, Cavaliere=4
 *   - Maggioranze dentro e fuori lette dinamicamente da config.js (stronghold_in, stronghold_out)
 *   - Prerequisito Fante in Roccaforte per Maggioranza Fuori
 *   - Conteggio OutBase (1 VP ogni 4 elementi tra truppe+legno +1 per Arc/Kni)
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
     * sia dentro che fuori dalla Fortezza leggendo i parametri da NS.MAJORITY_CONFIG (senza ternari nè else).
     */
    NS.Game.prototype.chooseAIStrongholdDeposit = function(p) {
        if (!p.infantry || p.infantry <= 0) return 0;

        const archersInHand = p.archer || 0;
        const knightsInHand = p.knight || 0;
        const woodInHand = p.wood || 0;
        const opponents = this.players.filter(pl => pl.id !== p.id);

        let bestK = 0;
        let maxNetVP = -999;

        const cfgIn = NS.MAJORITY_CONFIG.stronghold_in;
        const cfgOut = NS.MAJORITY_CONFIG.stronghold_out.infantry;

        // Simulazione per ogni possibile quantità k di fanti versati (da 0 a p.infantry)
        for (let k = 0; k <= p.infantry; k++) {
            // Stato DENTRO simulato
            const simInfantryInside = (p.stronghold.infantry || 0) + k;
            const simArchersInside = (p.stronghold.archer || 0) + archersInHand;
            const simKnightsInside = (p.stronghold.knight || 0) + knightsInHand;

            // Stato FUORI simulato
            const simInfantryOutside = p.infantry - k;
            const simArchersOutside = 0;
            const simKnightsOutside = 0;
            const simWoodOutside = woodInHand;

            // ----------------------------------------------------
            // 1. CALCOLO PUNTEGGIO DENTRO LA FORTEZZA
            // ----------------------------------------------------
            // Punti Unità dentro (1 VP ogni 2 Fanti, 2 VP per Arciere, 4 VP per Cavaliere)
            const vpInsideUnits = Math.floor(simInfantryInside / 2) + 
                                  (simArchersInside * 2) + 
                                  (simKnightsInside * 3);

            // Calcolo stima maggioranze dentro
            let vpInsideMaj = 0;

            const evalInsideCategory = (simVal, prop, pts1, pts2, tie1, tie2) => {
                const oppVals = opponents.map(o => o.stronghold[prop] || 0);
                const higher = oppVals.filter(v => v > simVal).length;
                const equal = oppVals.filter(v => v === simVal).length;

                if (simVal === 0) return 0;
                if (higher === 0) {
                    if (equal > 0) return tie1;
                    return pts1;
                }
                if (higher === 1) {
                    if (equal > 0) return tie2;
                    return pts2;
                }
                return 0;
            };

            vpInsideMaj += evalInsideCategory(simInfantryInside, 'infantry', cfgIn.infantry.first, cfgIn.infantry.second, cfgIn.infantry.tieFirst, cfgIn.infantry.tieSecond);
            vpInsideMaj += evalInsideCategory(simArchersInside, 'archer', cfgIn.archer.first, cfgIn.archer.second, cfgIn.archer.tieFirst, cfgIn.archer.tieSecond);
            vpInsideMaj += evalInsideCategory(simKnightsInside, 'knight', cfgIn.knight.first, cfgIn.knight.second, cfgIn.knight.tieFirst, cfgIn.knight.tieSecond);

            // ----------------------------------------------------
            // 2. CALCOLO PUNTEGGIO FUORI DALLA FORTEZZA (OutBase & Maggioranza)
            // ----------------------------------------------------
            // OutBase (1 VP ogni 4 tra truppe+legno + 1 cad per Arcieri e Cavalieri fuori)
            const totalOutItems = simInfantryOutside + simArchersOutside + simKnightsOutside + simWoodOutside;
            const vpOutsideUnits = Math.floor(totalOutItems / 4) + simArchersOutside + simKnightsOutside;

            // Maggioranza Fanti Fuori (Attiva SOLO se simInfantryInside >= 1)
            let vpOutsideMaj = 0;
            if (simInfantryInside >= 1 && simInfantryOutside > 0) {
                const eligibleOpponents = opponents.filter(o => (o.stronghold.infantry || 0) >= 1);
                const oppOutVals = eligibleOpponents.map(o => o.infantry || 0);
                const higher = oppOutVals.filter(v => v > simInfantryOutside).length;
                const equal = oppOutVals.filter(v => v === simInfantryOutside).length;

                if (higher === 0) {
                    vpOutsideMaj = cfgOut.first;
                    if (equal > 0) {
                        vpOutsideMaj = cfgOut.tieFirst;
                    }
                }
                if (higher === 1) {
                    vpOutsideMaj = cfgOut.second;
                    if (equal > 0) {
                        vpOutsideMaj = cfgOut.tieSecond;
                    }
                }
            }

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

        const isNuvoleCurrent = (this.currentEvent?.id === 'nuvole');
        const nextRoundIdx = this.round;
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

                if (s.id === 201 || s.id === 18) {
                    if (this.round === 5) score += 6;
                    if (stage === 'LATE') score += 30;
                }

                if (stage === 'EARLY') {
                    if (s.id === 12) score += 30;
                    if (s.reward && (s.reward.cattle || s.reward.coin)) score += 10;
                } else if (stage === 'MID') {
                    if (s.reward && (s.reward.wood || s.reward.brick)) score += 8;
                } else if (stage === 'LATE') {
                    if (s.type === 'vp') score += 25;
                    if (s.id === 8 && p.luxury > 0) score += 25 * p.luxury;
                    if (s.type === 'mil') score += 20;
                    if (s.id === 12) score -= 20;
                }

                if (stage === 'LATE') {
                    const hasTimeToBuild = (this.round < this.maxRounds) || (p.workers > 1);
                    if (s.reward && (s.reward.wood || s.reward.brick) && !s.reward.vp) {
                        if (!hasTimeToBuild || (p.hasResidence && p.brick < 3)) {
                            score -= 15;
                        }
                    }
                }

                if (isNuvoleActiveOrImminent) {
                    if (!isStrongholdBlocked && (s.id === 2 || s.name?.includes('Roccaforte'))) {
                        score += 60;
                    } else if (s.id === 7 || s.name?.includes('Accampamento')) {
                        score += 42;
                    } else if (s.id === 13 || s.name?.includes('Taverna')) {
                        score += 32;
                    } else if (s.type === 'mil') {
                        score += 26;
                    }
                }

                if (stage === 'LATE' && isStrongholdBlocked) {
                    if (s.type === 'mil') {
                        let maxOpponentOutsideInfantry = 0;
                        this.players.forEach(pl => {
                            if (pl.id !== p.id && pl.infantry > maxOpponentOutsideInfantry) {
                                maxOpponentOutsideInfantry = pl.infantry;
                            }
                        });
                        if (p.infantry + 1 >= maxOpponentOutsideInfantry) {
                            score += 30;
                        }
                    }
                }

                if (isCarestiaNext) {
                    if (s.id === 14 || s.id === 15) score -= 10;
                }

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
     * Stima il punteggio di un giocatore per la valutazione dell'IA (aggiornato a v1.2.0).
     */
    NS.Game.prototype.calculateProjectedScore = function(p) {
        let score = p.vp;
        score += Math.floor((p.stronghold.infantry || 0) / 2);
        score += (p.stronghold.archer || 0) * 2;
        score += (p.stronghold.knight || 0) * 3;
        if (p.hasResidence) score += 6;
        return score;
    };

    /**
     * APPLY SPECIAL REWARD AI
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
            if (p.wood >= 1 && p.cattle >= 1 && p.coin >= 5) {
                p.wood--;
                p.cattle--;
                p.coin -= 5;
                p.vp += 2;
                p.infantry += 3;
                p.archer += 2;
                return 'Accampamento (AI): 1 Legno +1 Bestiame +5 Monete → 2 VP +3 Fanti +2 Arcieri';
            } else if (p.wood >= 1) {
                p.wood--;
                p.vp += 2;
                p.infantry += 2;
                return 'Accampamento (AI): 1 Legno → 2 VP +2 Fanti';
            } else if (p.cattle >= 1) {
                p.cattle--;
                p.archer += 2;
                return 'Accampamento (AI): 1 Bestiame → 2 Arcieri';
            } else {
                return 'Accampamento (AI): nessuna azione (risorse insufficienti)';
            }
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
