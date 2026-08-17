(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.Game) return;

    NS.Game.prototype.aiMove = function(p) {
        let stage = 'EARLY';
        if (this.round >= 3 && this.round <= 5) stage = 'MID';
        else if (this.round >= 6) stage = 'LATE';

        let maxScore = -1;
        let leaderId = -1;
        this.players.forEach(pl => {
            let s = this.calculateProjectedScore(pl);
            if (s > maxScore) { maxScore = s; leaderId = pl.id; }
        });
        const amIWinning = (leaderId === p.id);

        let opts = [];
        
        if(!p.techUsed) {
            this.currentTechs.forEach((t, i) => { 
                if(t.takenBy === null) {
                    let techScore = 10;
                    if (t.id === 1 && (stage === 'EARLY' || p.maxWorkers < 4)) techScore += 50; 
                    else if (t.id === 1) techScore += 5;
                    opts.push({ type: 'tech', idx: i, score: techScore }); 
                }
            });
        }

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
            const cantiereCurrentCost = 2 + this.cantiereInflation;

            if (p.workers >= wc && p.coin >= coinCost && (!s.cost.wood || p.wood >= s.cost.wood) && (p.brick >= brickCost) && (!s.cost.cattle || p.cattle >= s.cost.cattle)) {
                
                let score = 5 + Math.random() * 10;

                if (p.archetype === 'GENERAL') {
                    if (s.type === 'mil') score += 15;
                    if (s.id === 7 && stage !== 'EARLY') score += 20;
                    if (s.type === 'mil') {
                        score += 30; // bonus uniforme per fanteria/arcieri/cavalieri
                    }
                }

                if (p.archetype === 'MERCHANT') {
                    if (s.id === 14 || s.id === 15 || s.id === 16) score += 15;
                    if (s.reward && s.reward.coin) score += 5;
                    if (s.id === 17 && stage === 'MID') score += 10;
                }

                if (p.archetype === 'ARCHITECT') {
                    if (s.reward && (s.reward.wood || s.reward.brick)) score += 15;
                    if (s.id === 17) score += 25;
                    if (s.id === 17) {
                        let threat = this.players.some(opp => opp.id !== p.id && !opp.passed && opp.workers > 0 && opp.brick >= cantiereCurrentCost);
                        if (threat) score += 40;
                    }
                }

                if (s.id === 12 && stage === 'EARLY') score += 30;
                if (s.id === 201 && this.accumulatedCoinsPorta > 2) score += 25;
                if (s.id === 8 && p.luxury > 0) score += 20 * p.luxury;
                if (s.id === 17 && p.hasResidence && stage === 'LATE') score -= 10;
                
                if (!amIWinning && stage === 'LATE') {
                    if (s.type === 'vp') score += 15;
                }

                opts.push({ type: 'space', id: s.id, score: score });
            }
        });
        
        if(opts.length === 0) { this.passTurn(); return; }
        
        opts.sort((a,b) => b.score - a.score);
        const best = opts[0];
        let success = false;
        
        if(best.type === 'tech') success = this.executeTech(p, best.idx);
        else success = this.executeAction(p, best.id);
        
        if (!success) {
            console.warn(`AI ${p.name} failed move.`);
            this.passTurn();
        }
    };
})();
