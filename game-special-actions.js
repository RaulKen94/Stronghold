/**
 * GAME-SPECIAL-ACTIONS.JS
 * Gestione degli effetti speciali dei luoghi e delle scelte utente.
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.Game) return;

    /**
     * APPLY SPECIAL REWARD
     * Applica l'effetto speciale di uno spazio (Piazza, Monastero, Taverna, ecc.)
     * e registra la relativa azione nella history.
     */
    NS.Game.prototype.applySpecialReward = function(type, p, spaceId, choiceData = null) {
        let historyDesc = '';

        if (type === 'piazza') {
            p.coin += 1;
            if (choiceData) {
                if (choiceData.resource === 'wood') {
                    p.wood++;
                    historyDesc = 'Piazza: +1 Legno';
                } else if (choiceData.resource === 'brick') {
                    p.brick++;
                    historyDesc = 'Piazza: +1 Mattone';
                }
            } else if (!p.isHuman) {
                historyDesc = this.applySpecialRewardAI(type, p, spaceId);
            } else {
                historyDesc = 'Piazza: scelta risorsa';
            }
        } else if (type === 'roccaforte') {
            p.vp += 1;
            if (p.isHuman) this.showFloatingText(spaceId, `+1🏆`, 'yellow');
            historyDesc = 'Roccaforte: +1 VP';
        } else if (type === 'porta') {
            const amt = this.accumulatedCoinsPorta;
            if (amt > 0) {
                p.coin += amt;
                this.accumulatedCoinsPorta = 0;
                historyDesc = `Porta: +${amt} Monete`;
            } else {
                historyDesc = 'Porta: nessuna moneta accumulata';
            }
        } else if (type === 'consiglio') {
            p.vp += 1;
            if (p.isHuman) this.showFloatingText(spaceId, '+1🏆', 'yellow');
        
            let gained = [];
            ['knight', 'archer', 'infantry'].forEach(unit => {
                let maxOthers = 0;
                this.players.forEach(opp => {
                    if (opp.id !== p.id) maxOthers = Math.max(maxOthers, opp.stronghold[unit]);
                });
                if (p.stronghold[unit] < maxOthers) {
                    p[unit]++;
                    gained.push(unit);
                }
            });
        
            if (gained.length > 0) {
                historyDesc = `Consiglio: rinforzi (${gained.join(', ')}) + 1 VP`;
            } else {
                historyDesc = 'Consiglio: nessun rinforzo. +1 VP';
            }
        } else if (type === 'monastero') {
            if (choiceData) {
                if (choiceData.resource === 'wood') {
                    p.wood++;
                    historyDesc = 'Monastero: +1 Legno';
                } else if (choiceData.resource === 'brick') {
                    p.brick++;
                    historyDesc = 'Monastero: +1 Mattone';
                } else if (choiceData.resource === 'cattle') {
                    p.cattle++;
                    historyDesc = 'Monastero: +1 Bestiame';
                }
            } else if (!p.isHuman) {
                historyDesc = this.applySpecialRewardAI(type, p, spaceId);
            } else {
                historyDesc = 'Monastero: scelta risorsa';
            }
        } else if (type === 'taverna') {
            if (choiceData) {
                if (choiceData.option === 'A') {
                    p.brick++;
                    p.brick++;
                    p.brick++;
                    p.vp++;
                    p.vp++;
                    p.vp++;
                    historyDesc = 'Taverna: +3 Mattone +3 VP';
                } else if (choiceData.option === 'B') {
                    p.wood++;
                    p.wood++;
                    p.cattle++;
                    p.cattle++;
                    p.cattle++;
                    p.cattle++;
                    p.cattle++;
                    p.cattle++;
                    p.cattle++;
                    historyDesc = 'Taverna: +2 Legno +7 Bestiame';
                } else if (choiceData.option === 'C') {
                    p.archer++;
                    historyDesc = 'Taverna: +1 Arciere';
                } else if (choiceData.option === 'D') {
                    p.infantry++;
                    p.infantry++;
                    p.vp++;
                    historyDesc = 'Taverna: +2 Fante +1 VP';
                }
            } else if (!p.isHuman) {
                historyDesc = this.applySpecialRewardAI(type, p, spaceId);
            } else {
                historyDesc = 'Taverna: scelta menu';
            }
        } else if (type === 'accampamento') {
            if (choiceData) {
                if (choiceData.option === 'wood') {
                    if (p.wood >= 1) {
                        p.wood--;
                        p.vp++;
                        p.infantry++;
                        historyDesc = 'Accampamento: 1 Legno → 1 VP +1 Fante';
                    }
                } else if (choiceData.option === 'cattle') {
                    if (p.cattle >= 1) {
                        p.cattle--;
                        p.archer++;
                        historyDesc = 'Accampamento: 1 Bestiame → 1 Arciere';
                    }
                } else if (choiceData.option === 'all') {
                    if (p.wood >= 1 && p.cattle >= 1 && p.coin >= 3) {
                        p.wood--;
                        p.cattle--;
                        p.coin -= 3;
                        p.vp += 2;
                        p.infantry += 2;
                        p.archer++;
                        historyDesc = 'Accampamento: 1 Legno +1 Bestiame +3 Monete → 2 VP +2 Fanti +1 Arciere';
                    }
                }
            } else if (!p.isHuman) {
                historyDesc = this.applySpecialRewardAI(type, p, spaceId);
            } else {
                historyDesc = 'Accampamento: scelta truppe';
            }
        } else if (type === 'gogna') {
            if (choiceData) {
                if (choiceData.targetId !== undefined) {
                    const target = this.players.find(pl => pl.id === choiceData.targetId);
                    if (target) {
                        this.gognaTarget = target.id;
                        historyDesc = `Gogna: ${target.name}`;
                    }
                }
            } else if (!p.isHuman) {
                historyDesc = this.applySpecialRewardAI(type, p, spaceId);
            } else {
                historyDesc = 'Gogna: scelta vittima';
            }
        }

        if (historyDesc) {
            this.recordAction({
                player_id: p.id,
                type: 'special',
                desc: historyDesc,
                turn: this.currentPlayerIndex
            });
        }
    };

    /**
     * SEND CHOICE
     * Invia una scelta speciale (o la applica localmente in singleplayer).
     */
    NS.Game.prototype.sendChoice = function(choiceData) {
        if (this.isMultiplayer && this.sendMove) {
            const p = this.players[this.currentPlayerIndex];
            this.sendMove({
                player_id: p.id,
                move_type: 'space',
                space_id: this.pendingSpace.id,
                choiceData: choiceData
            });
            document.getElementById('choice-modal').style.display = 'none';
            document.getElementById('gogna-modal').style.display = 'none';
            this.pendingSpace = null;
        } else {
            const p = this.players[this.currentPlayerIndex];
            this.applySpecialReward(this.pendingSpace.reward.special, p, this.pendingSpace.id, choiceData);
            this.finishSpecial();
        }
    };
})();
