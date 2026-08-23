/**
 * ======================================================
 * AI.JS - v1.5.0
 * ======================================================
 * Gestione avanzata dell'Intelligenza Artificiale (Eurogame AI):
 * - Gestione iniziativa e Primo Giocatore (Punto 2: min R5, max R6-7)
 * - Fasi di gioco bilanciate EARLY/MID/LATE (Punto 3: no cantiere monomaniaco)
 * - Prevenzione degli sprechi di risorse in LATE game (Punto 4)
 * - Pianificazione tattica truppe e Roccaforte con conoscenza limitata eventi R+1 (Punto 6)
 * ======================================================
 */

(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.Game) return;

    // ============ METODI DELL'IA ============

    /**
     * CHOOSE AI STRONGHOLD DEPOSIT
     * Decide quanti fanti depositare nella Roccaforte considerando:
     * - Evento del round successivo (solo R e R+1)
     * - Doppia maggioranza fanti (confronto fanti dentro e fanti fuori di tutti i giocatori)
     */
    NS.Game.prototype.chooseAIStrongholdDeposit = function(p) {
        if (!p.infantry || p.infantry <= 0) return 0;

        // Conoscenza limitata: solo evento attuale (R) e round successivo (R+1)
        const nextRoundIdx = this.round; // indice per R+1 (nella coda 0-indexed)
        const nextEvent = (nextRoundIdx < this.maxRounds && this.eventQueue) ? this.eventQueue[nextRoundIdx] : null;
        const isNuvoleNext = nextEvent && nextEvent.id === 'nuvole';

        // Se al prossimo round ci sono Nuvole Dappertutto (rischio blocco Roccaforte al R7), deposita tutto
        if (isNuvoleNext) {
            return p.infantry;
        }

        // Analisi della concorrenza sui fanti degli avversari
        let maxInsideOpponent = 0;
        let maxOutsideOpponent = 0;

        this.players.forEach(pl => {
            if (pl.id !== p.id) {
                if (pl.stronghold.infantry > maxInsideOpponent) {
                    maxInsideOpponent = pl.stronghold.infantry;
                }
                if (pl.infantry > maxOutsideOpponent) {
                    maxOutsideOpponent = pl.infantry;
                }
            }
        });

        const currentInside = p.stronghold.infantry;

        // In LATE Game (Round 6-7)
        if (this.round >= 6) {
            // Calcola quanti fanti servono per superare il miglior avversario nella Roccaforte
            const neededForInsideLead = Math.max(0, (maxInsideOpponent + 1) - currentInside);

            if (neededForInsideLead <= p.infantry && neededForInsideLead > 0) {
                // Se possiamo conquistare il 1° posto dentro con una parte dei fanti, versiamo esattamente quelli
                return neededForInsideLead;
            } else if (neededForInsideLead === 0) {
                // Siamo già primi dentro
                if (this.round >= this.maxRounds) {
                    return p.infantry; // Al Round 7 finale, deposita tutto per garantire punti
                }
                // Al Round 6 manteniamo un piccolo margine (+1) e teniamo il resto fuori
                const safetyBuffer = (currentInside - maxInsideOpponent);
                if (safetyBuffer < 2 && p.infantry > 0) return 1;
                return 0; // Conserva i fanti fuori per lottare sulla maggioranza esterna
            } else {
                // Non riusciamo a superare il primo, deposita tutto se è il round finale
                if (this.round >= this.maxRounds) return p.infantry;
                return Math.ceil(p.infantry / 2);
            }
        }

        // In EARLY / MID Game (Round 1-5): deposito bilanciato
        const neededToLead = Math.max(0, (maxInsideOpponent + 1) - currentInside);
        if (neededToLead > 0 && neededToLead <= p.infantry) {
            return neededToLead;
        }
        return Math.floor(p.infantry / 2);
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

        // Controllo evento imminente (R+1)
        const nextRoundIdx = this.round;
        const nextEvent = (nextRoundIdx < this.maxRounds && this.eventQueue) ? this.eventQueue[nextRoundIdx] : null;
        const isNuvoleNext = nextEvent && nextEvent.id === 'nuvole';
        const isCarestiaNext = nextEvent && nextEvent.id === 'famine';
    
        let opts = [];

        // 1. VALUTAZIONE TECNOLOGIE
        if (!p.techUsed) {
            this.currentTechs.forEach((t, i) => {
                if (t.takenBy === null) {
                    let techScore = 10;
                    // Early Game / Lavoratori
                    if (t.id === 1 && (stage === 'EARLY' || p.maxWorkers < 4)) techScore += 50;
                    else if (t.id === 1 && stage === 'LATE') techScore = 0; // Lavoratori svalutati in LATE
                    
                    // Iniziativa / Primo giocatore (Punto 2)
                    if (t.id === 18 || (t.text && t.text.includes('👑'))) {
                        if (this.round === 5) techScore += 8; // Importanza minima al R5
                        if (stage === 'LATE') techScore += 28; // Importanza alta al R6-7
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

                // ----- PUNTO 2: VALUTAZIONE INIZIATIVA (PRIMO GIOCATORE 👑) -----
                if (s.id === 201 || s.id === 18) { // Porta della Città o Primo Giocatore
                    if (this.round === 5) score += 6; // Importanza minima al Round 5
                    if (stage === 'LATE') score += 30; // Importanza alta al Round 6 e 7
                }

                // ----- PUNTO 3: BILANCIAMENTO FASI (EARLY / MID / LATE) -----
                if (stage === 'EARLY') {
                    // Sviluppo lavoratori e rendita
                    if (s.id === 12) score += 30; // +1👷
                    if (s.reward && (s.reward.cattle || s.reward.coin)) score += 10;
                } else if (stage === 'MID') {
                    // Crescita bilanciata (senza priorità ossessiva al Cantiere)
                    if (s.reward && (s.reward.wood || s.reward.brick)) score += 8;
                } else if (stage === 'LATE') {
                    // Massimizzazione conversioni in Punti Vittoria
                    if (s.type === 'vp') score += 25;
                    if (s.id === 8 && p.luxury > 0) score += 25 * p.luxury; // Palazzo
                    if (s.type === 'mil') score += 20; // Reclutamento truppe per Roccaforte
                    
                    // Svalutazione crescita a lungo termine
                    if (s.id === 12) score -= 20; // Non servono nuovi lavoratori in LATE
                }

                // ----- PUNTO 4: PREVENZIONE SPRECHI RISORSE -----
                if (stage === 'LATE') {
                    const hasTimeToBuild = (this.round < this.maxRounds) || (p.workers > 1);
                    if (s.reward && (s.reward.wood || s.reward.brick) && !s.reward.vp) {
                        if (!hasTimeToBuild || (p.hasResidence && p.brick < 3)) {
                            score -= 15; // Svaluta risorse inutilizzabili a fine partita
                        }
                    }
                }

                // ----- PUNTO 6: ANTEPRIMA EVENTI R+1 (NUVOLE / CARESTIA) -----
                if (isNuvoleNext && stage === 'LATE') {
                    if (s.type === 'mil') score += 35;
                    if (s.id === 8) score += 30;
                }
                if (isCarestiaNext) {
                    if (s.id === 14 || s.id === 15) score -= 10; // Mercati a rischio blocco
                }

                // ----- ARCHETIPI -----
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
    
        // Esegui la mossa localmente
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
