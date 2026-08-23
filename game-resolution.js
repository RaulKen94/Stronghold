/**
 * ======================================================
 * GAME-RESOLUTION.JS - v1.1.0
 * ======================================================
 * Gestione della risoluzione di fine round:
 * depositi in Roccaforte (con AI tattica v1.5.0), costruzioni al Cantiere e avanzamento della coda.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.Game) return;

    /**
     * GET STRONGHOLD DESCRIPTION
     * Restituisce la descrizione unica del deposito in Roccaforte.
     */
    NS.Game.prototype.getStrongholdDescription = function(auto, infantry) {
        const parts = [];
        if (auto.archer > 0) parts.push(`${auto.archer} arcieri`);
        if (auto.knight > 0) parts.push(`${auto.knight} cavalieri`);
        if (infantry > 0) parts.push(`${infantry} fanti`);
        return parts.length > 0 ? 'Roccaforte: deposita ' + parts.join(', ') : 'Roccaforte: nessun deposito';
    };

    /**
     * PROCESS STRONGHOLD QUEUE
     * Gestisce il deposito delle truppe nella Roccaforte.
     */
    NS.Game.prototype.processStrongholdQueue = function() {
        if (this.strongholdQueue.length === 0) {
            if (this.cantiereQueue.length > 0) this.processCantiereQueue();
            else this.finalizeRound();
            return;
        }

        const pid = this.strongholdQueue.shift();
        const p = this.players[pid];

        // Arcieri e cavalieri vengono depositati automaticamente
        if (p.archer > 0) {
            p.stronghold.archer += p.archer;
            p.archer = 0;
        }
        if (p.knight > 0) {
            p.stronghold.knight += p.knight;
            p.knight = 0;
        }

        // Fanteria: scelta per umano locale, attesa per umano remoto, automatica/tattica per AI
        if (p.infantry > 0) {
            if (p.isHuman) {
                if (p.isLocal) {
                    // Il giocatore locale sceglie quanti fanti depositare
                    this.renderStrongholdModal(p);
                }
                // Se è un umano remoto, non facciamo nulla: aspetteremo la sua scelta
                return;
            } else {
                // AI: deposito tattico (confronto doppia maggioranza e anteprima eventi)
                const putIn = (typeof this.chooseAIStrongholdDeposit === 'function') 
                    ? this.chooseAIStrongholdDeposit(p) 
                    : (this.rng() > 0.2 ? p.infantry : 0);

                p.stronghold.infantry += putIn;
                p.infantry -= putIn;
                this.recordAction({
                    player_id: p.id,
                    type: 'stronghold',
                    desc: `Deposita ${putIn} fanti`,
                    turn: this.currentPlayerIndex
                });
                this.processStrongholdQueue();
            }
        } else {
            this.processStrongholdQueue();
        }
    };

    /**
     * PROCESS CANTIERE QUEUE
     * Gestisce le costruzioni del Cantiere.
     */
    NS.Game.prototype.processCantiereQueue = function() {
        if (this.cantiereQueue.length === 0) {
            this.finalizeRound();
            return;
        }

        const pid = this.cantiereQueue.shift();
        const p = this.players[pid];

        if (p.isHuman) {
            if (p.isLocal) {
                // Il giocatore locale sceglie cosa costruire
                this.openBuildTypeModal(p);
            }
            // Se è un umano remoto, restiamo in attesa della sua mossa
            return;
        } else {
            // AI: costruzione automatica
            const chosen = this.chooseAIBuild(p);
            if (chosen) {
                if (chosen.type === 'blue') {
                    p.luxury--;
                    p.hasResidence = true;
                }
                this.applyBuild(p, chosen);
                this.processCantiereQueue();
            } else {
                // Nessun edificio disponibile
                this.processCantiereQueue();
            }
        }
    };

    /**
     * START NEXT RESOLUTION
     * Avvia o continua la risoluzione delle code (Roccaforte/Cantiere).
     */
    NS.Game.prototype.startNextResolution = function() {
        if (this.resolutionIndex >= this.resolutionQueue.length) {
            this.resolutionQueue = [];
            this.resolutionPhase = null;
            this.finalizeRound();
            return;
        }

        const entry = this.resolutionQueue[this.resolutionIndex];
        const p = this.players[entry.playerId];
        this.resolutionPhase = entry.type;

        if (entry.type === 'stronghold') {
            // Inizializza il deposito automatico per questo giocatore
            this.pendingStrongholdAuto = { archer: 0, knight: 0 };

            // Deposito automatico di arcieri e cavalieri (non registra ancora)
            if (p.archer > 0) {
                this.pendingStrongholdAuto.archer = p.archer;
                p.stronghold.archer += p.archer;
                p.archer = 0;
            }
            if (p.knight > 0) {
                this.pendingStrongholdAuto.knight = p.knight;
                p.stronghold.knight += p.knight;
                p.knight = 0;
            }

            // Gestione fanteria
            if (p.infantry > 0 && p.isHuman) {
                if (p.isLocal) {
                    this.renderStrongholdModal(p);
                }
                // Umano remoto: aspetta stronghold_deposit
                return;
            } else if (!p.isHuman) {
                // AI: deposita fanti usando la logica tattica
                const putIn = (typeof this.chooseAIStrongholdDeposit === 'function') 
                    ? this.chooseAIStrongholdDeposit(p) 
                    : (this.rng() > 0.2 ? p.infantry : 0);

                if (putIn > 0) {
                    p.stronghold.infantry += putIn;
                    p.infantry -= putIn;
                }
                const desc = this.getStrongholdDescription(this.pendingStrongholdAuto, putIn);
                this.recordAction({
                    player_id: p.id,
                    type: 'stronghold',
                    desc,
                    turn: this.currentPlayerIndex
                });
                this.pendingStrongholdAuto = { archer: 0, knight: 0 };
                this.advanceResolution();
            } else {
                // Umano senza fanteria: registra comunque il deposito automatico
                const desc = this.getStrongholdDescription(this.pendingStrongholdAuto, 0);
                this.recordAction({
                    player_id: p.id,
                    type: 'stronghold',
                    desc,
                    turn: this.currentPlayerIndex
                });
                this.pendingStrongholdAuto = { archer: 0, knight: 0 };
                this.advanceResolution();
            }
        } else if (entry.type === 'cantiere') {
            if (p.isHuman) {
                if (p.isLocal) {
                    this.openBuildTypeModal(p);
                }
                return;
            } else {
                const chosen = this.chooseAIBuild(p);
                if (chosen) {
                    if (chosen.type === 'blue') {
                        p.luxury--;
                        p.hasResidence = true;
                    }
                    this.applyBuild(p, chosen);
                    this.advanceResolution();
                } else {
                    this.advanceResolution();
                }
            }
        }
    };

    /**
     * ADVANCE RESOLUTION
     * Passa al prossimo giocatore nella coda di risoluzione.
     */
    NS.Game.prototype.advanceResolution = function() {
        this.resolutionIndex++;
        this.startNextResolution();
    };

    /**
     * FINALIZE ROUND
     * Aggiorna il primo giocatore e passa al round successivo o termina la partita.
     */
    NS.Game.prototype.finalizeRound = function() {
        const tokenClaimer = this.players.find(p => p.getIndicator);
        if (tokenClaimer) {
            this.firstPlayerIndex = tokenClaimer.id;
        }

        this.spaces.forEach(s => {
            if (!this.globalSpaceStats[s.id]) this.globalSpaceStats[s.id] = { name: s.name, count: 0 };
            this.globalSpaceStats[s.id].count += s.usage;
        });

        if (this.round >= this.maxRounds) {
            this.endGame();
        } else {
            this.round++;
            this.startRound();
            this.updateUI();
            this.checkAiTurn();
        }
    };
})();
