(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    class Game {
        constructor() {
            this.players = [];
            this.round = 1;
            this.maxRounds = 7;
            this.currentPlayerIndex = 0;
            this.firstPlayerIndex = 0;
            this.spaces = [];
            this.currentTechs = [];
            this.watchtowerBlocked = false;
            this.isGameOver = false;
            this.logs = [];
            this.pendingSpace = null;
            this.globalSpaceStats = {};
            
            this.currentEvent = null;
            this.eventHistory = [];
            this.eventQueue = []; 
            this.lockedSpaces = [];
            
            this.strongholdQueue = [];
            this.cantiereQueue = [];
            
            this.builtBuildings = []; 
            this.accumulatedCoinsPorta = 0;
            this.globalMoveCounter = 0;
            this.cantiereInflation = 0;
            this.marketUsage = 0;
            
            this.gognaTarget = null;
            this.tavernaUsedOptions = []; 

            this.initGame();
        }
        
        resetGame() {
            document.getElementById('end-modal').style.display = 'none';
            this.players = [];
            this.round = 1;
            this.currentPlayerIndex = 0;
            this.firstPlayerIndex = 0;
            this.spaces = [];
            this.currentTechs = [];
            this.watchtowerBlocked = false;
            this.isGameOver = false;
            this.logs = [];
            this.pendingSpace = null;
            this.globalSpaceStats = {};
            this.currentEvent = null;
            this.eventHistory = [];
            this.eventQueue = [];
            this.lockedSpaces = [];
            this.strongholdQueue = [];
            this.cantiereQueue = [];
            this.builtBuildings = [];
            this.accumulatedCoinsPorta = 0;
            this.globalMoveCounter = 0;
            this.cantiereInflation = 0;
            this.marketUsage = 0;
            this.gognaTarget = null;
            this.tavernaUsedOptions = [];

            const el = document.getElementById('game-log');
            if(el) el.innerHTML = '';
            
            this.initGame();
        }

        initGame() {
            for(let i=0; i<8; i++) {
                let r = Math.random(); let cum = 0; let sel = NS.EVENTS[NS.EVENTS.length - 1];
                for (let e of NS.EVENTS) { cum += e.prob; if (r < cum) { sel = e; break; } }
                this.eventQueue.push(sel);
            }

            const startCoins = [1, 2, 2, 5];
            this.firstPlayerIndex = Math.floor(Math.random() * 4);
            const archetypeKeys = ['GENERAL', 'MERCHANT', 'ARCHITECT'];

            for (let i = 0; i < 4; i++) {
                let coinIdx = (i - this.firstPlayerIndex + 4) % 4;
                let pArchetype = null;
                if (i !== 0) {
                     pArchetype = archetypeKeys[Math.floor(Math.random() * archetypeKeys.length)];
                }

                this.players.push({
                    id: i,
                    name: i === 0 ? "Tu" : `PC ${i}`,
                    archetype: pArchetype,
                    isHuman: i === 0,
                    coin: startCoins[coinIdx],
                    wood: 0, brick: 0, luxury: 0, cattle: 0,
                    infantry: 0, archer: 0, knight: 0,
                    workers: 2, maxWorkers: 2, futureWorkers: 0,
                    vp: 0,
                    stronghold: { infantry: 0, archer: 0, knight: 0 },
                    passed: false,
                    techUsed: false,
                    tech10Used: false,
                    getIndicator: false,
                    incomeModifier: 0,
                    hasResidence: false,
                    nextEventKnown: false,
                    extraTurn: false,
                    blockNextMoveSpaceId: null
                });
            }
            this.currentPlayerIndex = this.firstPlayerIndex;
            this.startRound();
            this.updateUI();
            this.checkAiTurn();
        }

        startRound() {
            this.log(`--- ROUND ${this.round} ---`);
            this.watchtowerBlocked = false;
            this.lockedSpaces = [];
            this.gognaTarget = null;
            this.tavernaUsedOptions = [];
            this.marketUsage = 0; 
            
            if(this.round > 1) {
                const cantiere = this.spaces.find(s => s.id === 17);
                if(cantiere) {
                    this.cantiereInflation += cantiere.slotsOccupied.length;
                }
            }

            const shuffled = [...NS.TECH_DEFINITIONS].sort(() => 0.5 - Math.random());
            this.currentTechs = shuffled.slice(0, 4).map(t => ({ ...t, takenBy: null }));
            
            if (this.round === 1) {
                this.spaces = JSON.parse(JSON.stringify(NS.BASE_SPACES));
            }
            this.spaces.forEach(s => { s.slotsOccupied = []; s.usage = 0; });

            const market = this.spaces.find(s => s.id === 15);
            if (market) {
                market.slots = 1;
                market.reward = { coin: 3 };
                market.name = "Mercato";
                market.short = "+3💰";
                delete market.reward.luxury;
            }

            if (this.round > 1) {
                this.currentEvent = this.eventQueue[this.round - 2]; 
            } else {
                this.currentEvent = { name: "Inizio Partita", emoji: "🏁", desc: "Buona fortuna!" };
            }
            
            this.eventHistory.push({ round: this.round, event: this.currentEvent, details: "" });
            this.log(`${this.currentEvent.emoji} Evento: ${this.currentEvent.name}`);

            if (this.currentEvent.id === 'black_market') {
                const m = this.spaces.find(s => s.id === 15);
                if (m) { 
                    m.slots = 3; 
                    m.reward.luxury = 1; 
                    m.short = "3->2->1💰 +1💎"; 
                    m.name = "Mercato Nero"; 
                }
            } else if (this.currentEvent.id === 'clouds' || this.currentEvent.id === 'famine') {
                const candidates = this.spaces.filter(s => s.id !== 2 && s.type !== 'blue').map(s => s.id);
                for (let i = candidates.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                }
                this.lockedSpaces = candidates.slice(0, this.currentEvent.id === 'clouds' ? 4 : 2);
                const lockedNames = this.spaces.filter(s => this.lockedSpaces.includes(s.id)).map(s => s.name).join(", ");
                this.eventHistory[this.eventHistory.length-1].details = `Bloccati: ${lockedNames}`;
            }

            this.players.forEach(p => {
                if (p.futureWorkers > 0) {
                    p.maxWorkers = Math.min(4, p.maxWorkers + p.futureWorkers);
                    p.futureWorkers = 0;
                }
                p.workers = p.maxWorkers;
                const income = 1 + Math.floor(p.cattle / 2) + p.incomeModifier;
                p.coin += income;
                p.passed = false;
                p.techUsed = false;
                p.getIndicator = false;
                p.nextEventKnown = false;
                p.blockNextMoveSpaceId = null; 
            });

            if (this.currentEvent && this.currentEvent.id === 'famine') {
                this.players.forEach(p => {
                    let cattleLost = 0;
                    if (p.cattle > 0) {
                        let toLose = Math.min(2, p.cattle);
                        p.cattle -= toLose;
                        cattleLost = toLose;
                    }
                    if (p.coin > 0) p.coin = Math.max(0, p.coin - 2);
                    if (cattleLost === 0) {
                        if (p.wood > 0) { p.wood--; this.log(`${p.name} perde 1 Legno.`); }
                        else if (p.brick > 0) { p.brick--; this.log(`${p.name} perde 1 Mattone.`); }
                    }
                });
                this.log("💀 Carestia applicata.");
            }

            this.currentPlayerIndex = this.firstPlayerIndex;
        }

        passTurn() {
            if (this.isGameOver) return;
            const p = this.players[this.currentPlayerIndex];
            if (p.passed) return;
            p.passed = true;
            this.log(`${p.name} passa.`);
            this.nextTurn();
        }

        nextTurn() {
            if (this.isGameOver) return;
            
            const curr = this.players[this.currentPlayerIndex];
            if (curr.extraTurn && !curr.passed) {
                curr.extraTurn = false;
                this.log(`${curr.name} gioca ancora!`);
                this.updateUI();
                setTimeout(() => this.checkAiTurn(), 600);
                return;
            }

            if (this.players.every(p => p.passed)) {
                this.endRound();
                return;
            }
            let checks = 0;
            do {
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 4;
                checks++;
            } while (this.players[this.currentPlayerIndex].passed && checks < 5);

            this.updateUI();
            setTimeout(() => this.checkAiTurn(), 600);
        }

        checkAiTurn() {
            const p = this.players[this.currentPlayerIndex];
            if (!p.isHuman && !p.passed && !this.isGameOver) {
                try { this.aiMove(p); } catch (e) { console.error("AI Error:", e); this.passTurn(); }
            }
        }

        endRound() {
            const fortSpace = this.spaces.find(s => s.id === 7);
            this.strongholdQueue = [...fortSpace.slotsOccupied].reverse();
            const cantiereSpace = this.spaces.find(s => s.id === 17);
            this.cantiereQueue = [...cantiereSpace.slotsOccupied]; 

            if (this.strongholdQueue.length > 0) this.processStrongholdQueue();
            else if (this.cantiereQueue.length > 0) this.processCantiereQueue();
            else this.finalizeRound();
        }

        processStrongholdQueue() {
            if (this.strongholdQueue.length === 0) {
                if (this.cantiereQueue.length > 0) this.processCantiereQueue();
                else this.finalizeRound();
                return;
            }
            const pid = this.strongholdQueue.shift();
            const p = this.players[pid];
            
            if (p.archer > 0) { p.stronghold.archer += p.archer; p.archer = 0; }
            if (p.knight > 0) { p.stronghold.knight += p.knight; p.knight = 0; }
            if (p.infantry > 0) {
                if (p.isHuman) this.renderStrongholdModal(p);
                else {
                    const putIn = Math.random() > 0.2 ? p.infantry : 0;
                    p.stronghold.infantry += putIn; p.infantry -= putIn;
                    this.log(`${p.name} deposita ${putIn} fanti.`);
                    this.processStrongholdQueue();
                }
            } else {
                this.log(`${p.name} processato in Roccaforte.`);
                this.processStrongholdQueue();
            }
        }

        processCantiereQueue() {
            if (this.cantiereQueue.length === 0) {
                this.finalizeRound();
                return;
            }
            const pid = this.cantiereQueue.shift();
            const p = this.players[pid];

            if (p.isHuman) {
                this.openBuildTypeModal();
            } else {
                this.aiBuild(p);
            }
        }

        finalizeRound() {
            const tokenClaimer = this.players.find(p => p.getIndicator);
            if (tokenClaimer) { this.firstPlayerIndex = tokenClaimer.id; this.log(`${tokenClaimer.name} 1° Giocatore.`); }
            
            this.spaces.forEach(s => { 
                if(!this.globalSpaceStats[s.id]) this.globalSpaceStats[s.id] = {name: s.name, count: 0};
                this.globalSpaceStats[s.id].count += s.usage; 
            });

            if (this.round >= this.maxRounds) this.endGame();
            else { this.round++; this.startRound(); this.updateUI(); this.checkAiTurn(); }
        }

        // --- BUILDING SYSTEM ---
        openBuildTypeModal() {
            document.getElementById('build-type-modal').style.display = 'flex';
            const p = this.players[0];
            const btnBlue = document.getElementById('btn-build-blue');
            if (p.hasResidence) btnBlue.className += " opacity-50 pointer-events-none";
            else btnBlue.className = btnBlue.className.replace(" opacity-50 pointer-events-none", "");
        }
        
        backToBuildType() {
            document.getElementById('build-list-modal').style.display = 'none';
            document.getElementById('build-type-modal').style.display = 'flex';
        }

        openBuildList(type) {
            document.getElementById('build-type-modal').style.display = 'none';
            const modal = document.getElementById('build-list-modal');
            const container = document.getElementById('build-list-container');
            container.innerHTML = '';
            const title = document.getElementById('build-list-title');
            title.innerText = type === 'vp' ? "Edifici Amministrativi (Gialli)" : (type === 'res' ? "Edifici Produttivi (Verdi)" : "Residenziale (Blu)");
            
            let list = [];
            if (type === 'blue') list = NS.NEW_BUILDINGS.filter(b => b.type === 'blue');
            else list = NS.NEW_BUILDINGS.filter(b => b.type === type);

            const p = this.players[0]; 

            list.forEach(b => {
                const isBuilt = this.builtBuildings.includes(b.id);
                const div = document.createElement('div');
                const canAfford = (b.type !== 'blue' || p.luxury >= 1);
                let extraClass = '';
                let label = '';

                if (isBuilt) { extraClass = 'disabled bg-slate-200 border-slate-300'; label = '<span class="text-xs font-bold text-slate-500">[GIÀ COSTRUITO]</span>'; }
                else if (!canAfford) { extraClass = 'opacity-50'; label = '<div class="text-xs font-bold text-red-500">Manca 1💎</div>'; }

                div.className = `build-card ${extraClass}`;
                div.innerHTML = `
                    <div class="flex justify-between items-start">
                        <div class="font-bold ${type==='vp'?'text-yellow-800':(type==='res'?'text-green-800':'text-blue-800')}">${b.name}</div>
                        ${label}
                    </div>
                    <div class="text-xs text-slate-600">${b.desc}</div>
                    ${b.bonusDesc ? `<div class="text-[10px] font-bold text-purple-600 mt-1">${b.bonusDesc}</div>` : ''}
                `;
                if (!isBuilt) {
                    div.onclick = () => this.confirmBuild(b);
                }
                container.appendChild(div);
            });
            modal.style.display = 'flex';
        }

        confirmBuild(b) {
            const p = this.players[0]; 
            if (b.type === 'blue') {
                if (p.luxury < 1) { return; }
                p.luxury--;
                p.hasResidence = true;
            }
            this.applyBuild(p, b);
            document.getElementById('build-list-modal').style.display = 'none';
            this.processCantiereQueue();
        }

        aiBuild(p) {
            if (!p.hasResidence && p.luxury >= 1) {
                const b = NS.NEW_BUILDINGS.find(x => x.type === 'blue');
                p.luxury--; p.hasResidence = true;
                this.applyBuild(p, b);
            } else {
                const avail = NS.NEW_BUILDINGS.filter(x => x.type !== 'blue' && !this.builtBuildings.includes(x.id));
                if (avail.length > 0) {
                    const b = avail[Math.floor(Math.random() * avail.length)];
                    this.applyBuild(p, b);
                }
            }
            this.processCantiereQueue();
        }

        applyBuild(p, b) {
            this.log(`${p.name} costruisce: ${b.name}`);
            if (b.type !== 'blue') this.builtBuildings.push(b.id);
            if (b.onBuild) b.onBuild(p);

            const newSpace = JSON.parse(JSON.stringify(b));
            newSpace.ownerId = p.id;
            newSpace.slotsOccupied = [];
            newSpace.usage = 0;
            this.spaces.push(newSpace);
        }

        attemptClickSpace(spaceId) {
            if (this.isGameOver) return;
            const p = this.players[this.currentPlayerIndex];
            if (!p.isHuman || p.passed) return;
            this.executeAction(p, spaceId);
        }

        executeAction(p, spaceId) {
            const space = this.spaces.find(s => s.id === spaceId);
            
            if (space.type === 'blue') return false; 
            let workerCost = space.cost.workerCost || 1;
            if (p.workers < workerCost) return this.flashError("Lavoratori insufficienti!");
            if (space.slots !== 99 && space.slotsOccupied.length >= space.slots) return this.flashError("Spazio pieno!");
            if (space.uniquePlayer && space.slotsOccupied.includes(p.id)) return this.flashError("Sei già qui!");
            if (space.id === 2 && this.watchtowerBlocked) return this.flashError("Bloccato dalla Tech!");
            if (this.lockedSpaces.includes(space.id)) return this.flashError("Bloccato dall'Evento!");
            if (this.gognaTarget === p.id && (space.type === 'mil' || space.id === 2)) return this.flashError("Sei alla Gogna!");
            if (p.blockNextMoveSpaceId !== null && p.blockNextMoveSpaceId === space.id) return this.flashError("Spazio bloccato dai Bagni!");

            if (space.ownerId !== undefined && space.ownerId !== p.id && space.type !== 'blue') {
                if (p.coin < 1) return this.flashError("Devi 1 moneta al proprietario!");
                p.coin--;
                this.players[space.ownerId].coin++;
                this.log(`${p.name} paga 1💰 a ${this.players[space.ownerId].name}`);
            }

            let coinCost = space.cost.coin || 0;
            if (this.currentEvent && this.currentEvent.id === 'war' && space.type === 'mil') coinCost = Math.max(0, coinCost - 1);

            let brickCost = space.cost.brick || 0;
            if (space.id === 17) {
                brickCost += this.cantiereInflation;
            }

            if ((coinCost > 0 && p.coin < coinCost) ||
                (space.cost.wood && p.wood < space.cost.wood) ||
                (brickCost > 0 && p.brick < brickCost) ||
                (space.cost.cattle && p.cattle < space.cost.cattle)) return this.flashError(`Risorse insufficienti! Cantiere: ${brickCost}🧱`);

            p.workers -= workerCost;
            if (coinCost > 0) p.coin -= coinCost;
            if (space.cost.wood) p.wood -= space.cost.wood;
            if (brickCost > 0) p.brick -= brickCost;
            if (space.cost.cattle) p.cattle -= space.cost.cattle;

            if (space.id === 8) { 
                if (p.luxury <= 0) { p.workers += workerCost; return this.flashError("No Lusso!"); }
                let amount = p.luxury; p.luxury = 0; p.vp += (amount * 3);
                this.showFloatingText(space.id, `+${amount*3}🏆`, 'yellow');
                this.finalizeMove(space, p); 
                return true;
            }

            if (space.id === 15) {
                 let baseReward = Math.max(1, 3 - this.marketUsage);
                 p.coin += baseReward;
                 this.marketUsage++;
                 if(space.reward.luxury) p.luxury++;
                 this.visualizeReward(space.id, 'coin', baseReward);
                 if(space.reward.luxury) this.visualizeReward(space.id, 'luxury', 1);
                 this.finalizeMove(space, p);
                 return true;
            }

            if (space.reward.special) {
                if (p.isHuman) {
                    const sp = space.reward.special;
                    if (['piazza','pozzo','monastero','taverna','accampamento','gogna'].includes(sp)) {
                        this.pendingSpace = space;
                        this.openSpecialModal(sp, p);
                        return true;
                    }
                }
                this.applySpecialReward(space.reward.special, p, space.id);
            } else {
                for(let k in space.reward) {
                    if(k === 'special') continue;
                    let qty = space.reward[k];
                    if (this.currentEvent?.id === 'war' && space.id === 3 && k === 'infantry') qty += 1;
                    if(typeof p[k] !== 'undefined') p[k] += qty;
                    else if(k==='newWorker') p.futureWorkers += qty;
                    else if(k==='firstPlayer') p.getIndicator = true;
                    if(p.isHuman) this.visualizeReward(space.id, k, qty);
                }
            }
            this.finalizeMove(space, p);
            return true;
        }

        applySpecialReward(type, p, spaceId) {
            if (type === 'piazza') {
                p.coin += 1;
                if(!p.isHuman) { if(Math.random()>0.5) p.wood++; else p.brick++; }
            } else if (type === 'pozzo') {
                 if(!p.isHuman) { p.wood < p.brick ? p.wood++ : p.brick++; }
            } else if (type === 'roccaforte') {
                p.vp += 1; if(p.isHuman) this.showFloatingText(spaceId, `+1🏆`, 'yellow');
            } else if (type === 'porta') {
                const amt = this.accumulatedCoinsPorta;
                if(amt > 0) { p.coin += amt; this.accumulatedCoinsPorta = 0; this.log(`${p.name} raccoglie ${amt}💰 dalla Porta.`); }
            } else if (type === 'consiglio') {
                let gained = [];
                ['knight', 'archer', 'infantry'].forEach(unit => {
                    let maxOthers = 0;
                    this.players.forEach(opp => { if(opp.id !== p.id) maxOthers = Math.max(maxOthers, opp.stronghold[unit]); });
                    if(p.stronghold[unit] < maxOthers) {
                        p[unit]++;
                        gained.push(unit);
                    }
                });
                if(gained.length > 0) this.log(`${p.name} ottiene rinforzi dal Consiglio.`);
            }
            else if (!p.isHuman) {
                 if(type==='monastero') p.wood++;
                 else if(type==='taverna') { p.infantry++; p.vp++; }
                 else if(type==='accampamento') { if(p.wood>0){p.wood--; p.vp++; p.infantry++;} }
                 else if(type==='gogna') { 
                     const target = this.players.find(pl => pl.id !== p.id && pl.id !== spaceId.ownerId); 
                     if(target) this.gognaTarget = target.id;
                 }
            }
        }

        finalizeMove(space, p) {
            space.slotsOccupied.push(p.id);
            space.usage++;
            this.log(`${p.name} usa ${space.name}`);

            this.globalMoveCounter++;
            if (this.globalMoveCounter % 3 === 0 && space.id !== 201) {
                const porta = this.spaces.find(s => s.id === 201);
                if (porta) this.accumulatedCoinsPorta++;
            }

            this.nextTurn();
        }

        attemptClickTech(techIdx) {
            if (this.isGameOver) return;
            const p = this.players[this.currentPlayerIndex];
            if (!p.isHuman || p.passed) return;
            this.executeTech(p, techIdx);
        }
        
        executeTech(p, techIdx) {
            if (p.techUsed) return this.flashError("Tech già usata!");
            const tech = this.currentTechs[techIdx];
            if (tech.takenBy !== null) return this.flashError("Già presa!");
            if (tech.id === 2) { 
                const used = this.currentTechs.filter(t => t.takenBy !== null && t.id !== 2);
                if(used.length === 0) { if(p.isHuman) alert("Nessuna tech da copiare. +3💰"); p.coin += 3; } 
                else { 
                    if(p.isHuman) return this.showCopyModal(used, p, techIdx); 
                    else {
                        const target = used[Math.floor(Math.random() * used.length)];
                        target.effect(p, this);
                        this.log(`${p.name} copia (AI) ${target.text}`);
                    }
                } 
            } else { if(typeof tech.effect === 'function') tech.effect(p, this); }
            tech.takenBy = p.id; p.techUsed = true; this.log(`${p.name} ricerca ${tech.text}`); 
            this.nextTurn();
            return true;
        }

        calculateProjectedScore(p) {
            let score = p.vp;
            score += Math.floor(p.stronghold.infantry / 3);
            score += Math.floor(p.stronghold.archer / 2);
            score += p.stronghold.knight;
            if (p.hasResidence) score += 6;
            return score;
        }

        endGame() {
            this.isGameOver = true; 
            this.updateUI();
            
            let scores = NS.calculateEndGameScores(this);
    
            const statsDiv = document.getElementById('spaces-stats');
            statsDiv.innerHTML = Object.entries(this.globalSpaceStats)
                .sort((a,b) => b[1].count - a[1].count)
                .map(([k,v]) => `<div class="flex justify-between border-b p-1"><span>${v.name}</span><span class="font-bold">${v.count}</span></div>`).join('');
        
            const histList = document.getElementById('event-history-list');
            histList.innerHTML = this.eventHistory.map(h => `<li class="mb-1 border-b pb-1"><strong>R${h.round} ${h.event.emoji}</strong> ${h.event.name}. ${h.details||''}</li>`).join('');

            // Tabella riepilogativa principale (già esistente)
            let html = `<table class="score-table w-full text-center border-collapse"><thead><tr class="text-slate-600 bg-slate-200"><th>#</th><th>Gioc</th><th>Ris</th><th>Fuori</th><th>Dentro</th><th>Dettagli</th><th>TOT</th></tr></thead><tbody>`;
            scores.forEach((s, i) => {
                html += `<tr class="${i===0 ? 'bg-yellow-50' : ''}"><td class="font-bold text-slate-500">${i+1}</td><td class="font-bold text-left ${s.p.id===0?'text-blue-600':'text-red-600'}">${s.p.name}</td>
                <td class="text-xs text-left">${s.p.coin}💰 ${s.p.wood}🪵 ${s.p.brick}🧱<br>${s.p.luxury}💎 ${s.p.cattle}🐄</td>
                <td class="text-xs">${s.p.infantry}⚔️ ${s.p.archer}🏹 ${s.p.knight}🐴</td><td class="text-xs bg-slate-100 font-bold text-slate-700">${s.p.stronghold.infantry}⚔️ ${s.p.stronghold.archer}🏹 ${s.p.stronghold.knight}🐴</td>
                <td class="text-xs text-left">Base:${s.base} Res:${s.res} FortB:${s.fortBase}<br>FortM:${s.fortMaj} OutM:${s.outMaj} Set:${s.troopOut}</td><td class="font-bold text-lg text-green-700">${s.total}</td></tr>`;
            });
            html += `</tbody></table>`;
            document.getElementById('score-breakdown').innerHTML = html;

                // --- NUOVA TABELLA DI DETTAGLIO ---
                let detailHtml = `<table class="score-table w-full text-center border-collapse">
                    <thead>
                        <tr>
                            <th class="th-gioc">Gioc</th>
                            <th colspan="3" class="th-ambra">Base</th>
                            <th colspan="3" class="th-pietra">Risorse</th>
                            <th colspan="3" class="th-ambra">Fortezza Base</th>
                            <th colspan="3" class="th-pietra">Fortezza Magg.</th>
                            <th class="th-ambra">Fuori Magg.</th>
                            <th colspan="4" class="th-pietra">Set</th>
                        </tr>
                        <tr>
                            <th class="th-gioc"></th>
                            <th class="th-ambra">PV</th>
                            <th class="th-ambra">1°</th>
                            <th class="th-ambra">Resid.</th>
                            <th class="th-pietra">Ris. Base</th>
                            <th class="th-pietra">Bestiame</th>
                            <th class="th-pietra">Lusso</th>
                            <th class="th-ambra">Fanti</th>
                            <th class="th-ambra">Arcieri</th>
                            <th class="th-ambra">Cavalieri</th>
                            <th class="th-pietra">Fanti</th>
                            <th class="th-pietra">Arcieri</th>
                            <th class="th-pietra">Cavalieri</th>
                            <th class="th-ambra">Fanti</th>
                            <th class="th-pietra">Nr. Fanti</th>
                            <th class="th-pietra">Nr. Arcieri</th>
                            <th class="th-pietra">Coppie PV</th>
                            <th class="th-pietra">Cavalieri</th>
                        </tr>
                    </thead>
                    <tbody>`;

            scores.forEach(s => {
                detailHtml += `<tr>
                    <td class="font-bold text-left ${s.p.id===0?'text-blue-600':'text-red-600'}">${s.p.name}</td>
                    <td>${s.baseVp}</td><td>${s.baseFirst}</td><td>${s.baseResidence}</td>
                    <td>${s.resBase}</td><td>${s.resCattle}</td><td>${s.resLuxury}</td>
                    <td>${s.fortBInf}</td><td>${s.fortBArc}</td><td>${s.fortBKni}</td>
                    <td>${s.fortMInf}</td><td>${s.fortMArc}</td><td>${s.fortMKni}</td>
                    <td>${s.outMInf}</td>
                    <td>${s.p.infantry}</td><td>${s.p.archer}</td><td>${s.outPairs}</td><td>${s.p.knight}</td>
                </tr>`;
            });
            detailHtml += `</tbody></table>`;
            document.getElementById('score-detail-breakdown').innerHTML = detailHtml;

            document.getElementById('end-modal').style.display = 'flex';
        }
    }

    NS.Game = Game;
})();
