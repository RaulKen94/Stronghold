(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    /**
     * CLASSE GAME
     * Rappresenta l'intera partita e gestisce tutte le meccaniche di gioco.
     */
    class Game {
        /**
         * COSTRUTTORE
         * @param {number} seed - seme per il generatore PRNG
         * @param {Array} playerConfig - configurazione giocatori (solo multiplayer)
         * @param {boolean} isHost - true se questo client è l'host (multiplayer)
         */
        constructor(seed, playerConfig, isHost = false) {
            this.seed = (seed !== undefined && seed !== null) ? seed : Math.floor(Math.random() * 1000000);
            this.rng = NS.mulberry32(this.seed);

            this.playerConfig = playerConfig || null;
            this.isMultiplayer = !!playerConfig;
            this.isHost = isHost;

            // Stato dei giocatori
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

            // Evento corrente e coda eventi
            this.currentEvent = null;
            this.eventHistory = [];
            this.eventQueue = [];
            this.lockedSpaces = [];

            // Code di risoluzione a fine round
            this.strongholdQueue = [];
            this.cantiereQueue = [];

            // Edifici e risorse globali
            this.builtBuildings = [];
            this.accumulatedCoinsPorta = 0;
            this.globalMoveCounter = 0;
            this.cantiereInflation = 0;
            this.marketUsage = 0;

            // Stato Gogna e Taverna
            this.gognaTarget = null;
            this.tavernaUsedOptions = [];

            // Callback per inviare mosse in multiplayer
            this.sendMove = null;
            this.pendingBuildPlayer = null;
            // Buffer per mosse remote in attesa (multiplayer)
            this.pendingMoves = [];
            // Supporto per la descrizione unica del deposito Stronghold
            this.pendingStrongholdAuto = { archer: 0, knight: 0 };
            // Stato risoluzione code (multiplayer)
            this.resolutionPhase = null;   // 'stronghold' | 'cantiere' | null
            this.resolutionQueue = [];     // array di { playerId, type }
            this.resolutionIndex = 0;      // indice corrente

            this.initGame();
        }

        /**
         * RESET GAME
         * Riporta lo stato iniziale e riavvia la partita.
         */
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
            this.actionHistory = [];
            // Reset stato multiplayer temporaneo
            this.sendMove = null;               // verrà reimpostato dall'adapter in multiplayer
            this.pendingBuildPlayer = null;
            this.pendingMoves = [];
            this.pendingStrongholdAuto = { archer: 0, knight: 0 };
            this.resolutionPhase = null;
            this.resolutionQueue = [];
            this.resolutionIndex = 0;

            const el = document.getElementById('game-log');
            if (el) el.innerHTML = '';

            this.initGame();
        }

        /**
         * INIZIALIZZAZIONE PARTITA
         * Crea i giocatori, genera la coda eventi, prepara il primo round.
         */
        initGame() {
            // Genera 8 eventi casuali in base alle probabilità
            for (let i = 0; i < 8; i++) {
                let r = this.rng();
                let cum = 0;
                let sel = NS.EVENTS[NS.EVENTS.length - 1];
                for (let e of NS.EVENTS) {
                    cum += e.prob;
                    if (r < cum) {
                        sel = e;
                        break;
                    }
                }
                this.eventQueue.push(sel);
            }

            // Primo giocatore casuale ma deterministico
            this.firstPlayerIndex = Math.floor(this.rng() * 4);

            if (this.playerConfig) {
                // Modalità multiplayer: usa la configurazione fornita
                const startCoins = [1, 2, 3, 4];
                this.players = this.playerConfig.map((cfg, i) => {
                    let coinIdx = (i - this.firstPlayerIndex + 4) % 4;
                    return {
                        id: i,
                        name: cfg.name || `Giocatore ${i + 1}`,
                        archetype: cfg.archetype || null,
                        isHuman: cfg.isHuman === undefined ? true : cfg.isHuman,
                        isLocal: cfg.isLocal === undefined ? false : cfg.isLocal,
                        dbPlayerId: cfg.dbPlayerId || null,
                        coin: startCoins[coinIdx],
                        wood: 0,
                        brick: 0,
                        luxury: 0,
                        cattle: 0,
                        infantry: 0,
                        archer: 0,
                        knight: 0,
                        workers: 2,
                        maxWorkers: 2,
                        futureWorkers: 0,
                        vp: 0,
                        stronghold: { infantry: 0, archer: 0, knight: 0 },
                        passed: false,
                        techUsed: false,
                        tech10Used: false,
                        getIndicator: false,
                        incomeModifier: 0,
                        hasResidence: false,
                        initialTurnOrder: coinIdx
                    };
                });
            } else {
                // Modalità single-player: 1 umano + 3 AI
                const startCoins = [1, 2, 3, 4];
                const archetypeKeys = ['GENERAL', 'MERCHANT', 'ARCHITECT'];
                this.players = [];
                for (let i = 0; i < 4; i++) {
                    let coinIdx = (i - this.firstPlayerIndex + 4) % 4;
                    let pArchetype = null;
                    if (i !== 0) {
                        pArchetype = archetypeKeys[Math.floor(this.rng() * archetypeKeys.length)];
                    }
                    this.players.push({
                        id: i,
                        name: i === 0 ? "Tu" : `PC ${i}`,
                        archetype: pArchetype,
                        isHuman: i === 0,
                        isLocal: i === 0,
                        coin: startCoins[coinIdx],
                        wood: 0,
                        brick: 0,
                        luxury: 0,
                        cattle: 0,
                        infantry: 0,
                        archer: 0,
                        knight: 0,
                        workers: 2,
                        maxWorkers: 2,
                        futureWorkers: 0,
                        vp: 0,
                        stronghold: { infantry: 0, archer: 0, knight: 0 },
                        passed: false,
                        techUsed: false,
                        tech10Used: false,
                        getIndicator: false,
                        incomeModifier: 0,
                        hasResidence: false,
                        initialTurnOrder: coinIdx
                    });
                }
            }

            this.currentPlayerIndex = this.firstPlayerIndex;
            this.startRound();
            this.updateUI();
            this.checkAiTurn();
        }

        /**
         * START ROUND
         * Prepara il nuovo round: evento, tecnologie, ripristino spazi, reddito.
         */
        startRound() {
            this.log(`--- ROUND ${this.round} ---`);
            this.watchtowerBlocked = false;
            this.lockedSpaces = [];
            this.gognaTarget = null;
            this.tavernaUsedOptions = [];
            this.marketUsage = 0;
            this.resolutionPhase = null;
            this.resolutionQueue = [];
            this.resolutionIndex = 0;

            if (this.round > 1) {
                const cantiere = this.spaces.find(s => s.id === 17);
                if (cantiere) {
                    this.cantiereInflation += cantiere.slotsOccupied.length;
                    if (this.cantiereInflation > 2) {
                        this.cantiereInflation = 2;
                    }
                }
            }

            const shuffled = [...NS.TECH_DEFINITIONS].sort(() => 0.5 - this.rng());
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

            this.currentEvent = this.round > 1 ? this.eventQueue[this.round - 2] : { name: "Inizio Partita", emoji: "🏁" };
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
                    const j = Math.floor(this.rng() * (i + 1));
                    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                }
                this.lockedSpaces = candidates.slice(0, this.currentEvent.id === 'clouds' ? 5 : 3);
                const lockedNames = this.spaces.filter(s => this.lockedSpaces.includes(s.id)).map(s => s.name).join(", ");
                this.eventHistory[this.eventHistory.length - 1].details = `Bloccati: ${lockedNames}`;
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
                        if (p.wood > 0) {
                            p.wood--;
                            this.log(`${p.name} perde 1 Legno.`);
                        } else if (p.brick > 0) {
                            p.brick--;
                            this.log(`${p.name} perde 1 Mattone.`);
                        }
                    }
                });
                this.log("💀 Carestia applicata.");
            }

            this.currentPlayerIndex = this.firstPlayerIndex;
        }

        /**
         * PASS TURN
         * Il giocatore corrente passa il turno.
         */
        passTurn() {
            if (this.isGameOver) return;
            if (this.resolutionPhase) return; // non si può passare durante la risoluzione
            const p = this.players[this.currentPlayerIndex];
            if (p.passed) return;
        
            if (this.isMultiplayer && this.sendMove && p.isHuman) {
                // Solo gli umani inviano la mossa "pass" al database
                this.sendMove({ player_id: p.id, move_type: 'pass' });
                return;
            }
        
            // Pass locale (single‑player o AI in multiplayer)
            p.passed = true;
            this.log(`${p.name} passa.`);
            this.recordAction({ player_id: p.id, type: 'pass', desc: 'Passa', turn: this.currentPlayerIndex });
            this.nextTurn();
        }

        /**
         * NEXT TURN
         * Passa al prossimo giocatore non passato, o termina il round.
         */
        nextTurn() {
            if (this.isGameOver) return;
            if (this.resolutionPhase) return; // la risoluzione gestisce il proprio avanzamento
            if (this.players.every(p => p.passed)) {
                this.endRound();
                return;
            }
            let checks = 0;
            do {
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 4;
                checks++;
            } while (this.players[this.currentPlayerIndex].passed && checks < 5);
        
            // Applica eventuali mosse remote in coda per questo turno
            this.flushPendingMoves();
        
            this.updateUI();
            setTimeout(() => this.checkAiTurn(), 600);
        }

        /**
         * CHECK AI TURN
         * Se il giocatore corrente è un'AI, esegue la sua mossa.
         */
        checkAiTurn() {
            if (this.resolutionPhase) return;
            const p = this.players[this.currentPlayerIndex];
            if (p.isHuman || p.passed || this.isGameOver) return;
            try {
                this.aiMove(p);
            } catch (e) {
                console.error("AI Error:", e);
                this.passTurn();
            }
        }

        /**
         * END ROUND
         * Prepara le code di processamento per Roccaforte e Cantiere.
         */
        endRound() {
            const fortSpace = this.spaces.find(s => s.id === 7);
            const cantiereSpace = this.spaces.find(s => s.id === 17);
        
            if (this.isMultiplayer) {
                // Costruisci la coda di risoluzione unificata
                this.resolutionQueue = [];
        
                // Roccaforte: ordine inverso di occupazione
                if (fortSpace && fortSpace.slotsOccupied.length > 0) {
                    const strongholdPlayers = [...fortSpace.slotsOccupied].reverse();
                    strongholdPlayers.forEach(pid => {
                        this.resolutionQueue.push({ playerId: pid, type: 'stronghold' });
                    });
                }
        
                // Cantiere: ordine normale
                if (cantiereSpace && cantiereSpace.slotsOccupied.length > 0) {
                    const cantierePlayers = [...cantiereSpace.slotsOccupied];
                    cantierePlayers.forEach(pid => {
                        this.resolutionQueue.push({ playerId: pid, type: 'cantiere' });
                    });
                }

                if (this.resolutionQueue.length === 0) {
                    this.finalizeRound();
                    return;
                }
        
                this.resolutionIndex = 0;
                this.resolutionPhase = null;
                this.startNextResolution();
                return;
            }
        
            // Single‑player: vecchio flusso
            this.strongholdQueue = [...fortSpace.slotsOccupied].reverse();
            this.cantiereQueue = [...cantiereSpace.slotsOccupied];
        
            if (this.strongholdQueue.length > 0) this.processStrongholdQueue();
            else if (this.cantiereQueue.length > 0) this.processCantiereQueue();
            else this.finalizeRound();
        }
        
        // ===================== AZIONI SPAZIO =====================

        /**
         * VALIDATE SPACE ACTION
         * Verifica se un'azione su uno spazio è valida per il giocatore senza applicarla.
         */
        validateSpaceAction(p, spaceId) {
            const space = this.spaces.find(s => s.id === spaceId);
            if (!space || space.type === 'blue') return false;
        
            let workerCost = space.cost.workerCost || 1;
            if (p.workers < workerCost) return false;
            if (space.slots !== 99 && space.slotsOccupied.length >= space.slots) return false;
            if (space.uniquePlayer && space.slotsOccupied.includes(p.id)) return false;
            if (space.id === 2 && this.watchtowerBlocked) return false;
            if (this.lockedSpaces.includes(space.id)) return false;
            if (this.gognaTarget === p.id && (space.type === 'mil' || space.id === 2)) return false;
        
            let coinCost = space.cost.coin || 0;
            if (this.currentEvent && this.currentEvent.id === 'war' && space.type === 'mil') coinCost = Math.max(0, coinCost - 1);
            let brickCost = space.cost.brick || 0;
            if (space.id === 17) brickCost += this.cantiereInflation;
        
            if ((coinCost > 0 && p.coin < coinCost) ||
                (space.cost.wood && p.wood < space.cost.wood) ||
                (brickCost > 0 && p.brick < brickCost) ||
                (space.cost.cattle && p.cattle < space.cost.cattle)) return false;
        
            if (space.ownerId !== undefined && space.ownerId !== p.id && space.type !== 'blue') {
                if (p.coin < 1) return false;
            }
        
            return true;
        }

        /**
         * VALIDATE TECH ACTION
         * Verifica se un'azione su una tecnologia è valida per il giocatore senza applicarla.
         */
        validateTechAction(p, techIdx) {
            if (p.techUsed) return false;
            const tech = this.currentTechs[techIdx];
            if (!tech || tech.takenBy !== null) return false;
            return true;
        }
        
        /**
         * ATTEMPT CLICK SPACE
         * Gestisce il click su uno spazio della plancia (solo umano).
         */
        attemptClickSpace(spaceId) {
            if (this.isGameOver) return;
            const p = this.players[this.currentPlayerIndex];
            if (!p || !p.isLocal || p.passed) return;
            if (p.id !== this.currentPlayerIndex) return;
        
            const space = this.spaces.find(s => s.id === spaceId);
            if (!space) return;
        
            if (this.isMultiplayer && this.sendMove) {
                if (!this.validateSpaceAction(p, spaceId)) return;
        
                if (space.reward && space.reward.special &&
                    p.isHuman &&
                    ['piazza','monastero','taverna','accampamento','gogna'].includes(space.reward.special)) {
                    this.pendingSpace = space;
                    this.openSpecialModal(space.reward.special, p);
                    return;
                }
        
                this.sendMove({
                    player_id: p.id,
                    move_type: 'space',
                    space_id: spaceId
                });
            } else {
                this.executeAction(p, spaceId);
            }
        }

        /**
         * EXECUTE ACTION
         * Esegue l'azione su uno spazio: controlla costi, applica ricompense.
         */
        executeAction(p, spaceId, isRemote = false, choiceData = null, advanceTurn = true) {
            const space = this.spaces.find(s => s.id === spaceId);
            if (!space || space.type === 'blue') return false;

            let workerCost = space.cost.workerCost || 1;
            if (p.workers < workerCost) return isRemote ? false : this.flashError("Lavoratori insufficienti!");
            if (space.slots !== 99 && space.slotsOccupied.length >= space.slots) return isRemote ? false : this.flashError("Spazio pieno!");
            if (space.uniquePlayer && space.slotsOccupied.includes(p.id)) return isRemote ? false : this.flashError("Sei già qui!");
            if (space.id === 2 && this.watchtowerBlocked) return isRemote ? false : this.flashError("Bloccato dalla Tech!");
            if (this.lockedSpaces.includes(space.id)) return isRemote ? false : this.flashError("Bloccato dall'Evento!");
            if (this.gognaTarget === p.id && (space.type === 'mil' || space.id === 2)) return isRemote ? false : this.flashError("Sei alla Gogna!");

            if (space.ownerId !== undefined && space.ownerId !== p.id && space.type !== 'blue') {
                if (p.coin < 1) return isRemote ? false : this.flashError("Devi 1 moneta al proprietario!");
                p.coin--;
                this.players[space.ownerId].coin++;
                this.log(`${p.name} paga 1💰 a ${this.players[space.ownerId].name}`);
            }

            let coinCost = space.cost.coin || 0;
            if (this.currentEvent && this.currentEvent.id === 'war' && space.type === 'mil') coinCost = Math.max(0, coinCost - 1);
            let brickCost = space.cost.brick || 0;
            if (space.id === 17) brickCost += this.cantiereInflation;

            if ((coinCost > 0 && p.coin < coinCost) ||
                (space.cost.wood && p.wood < space.cost.wood) ||
                (brickCost > 0 && p.brick < brickCost) ||
                (space.cost.cattle && p.cattle < space.cost.cattle)) {
            
                let missing = [];
                if (coinCost > 0 && p.coin < coinCost) missing.push(`${coinCost} monete`);
                if (space.cost.wood && p.wood < space.cost.wood) missing.push(`${space.cost.wood} legno`);
                if (brickCost > 0 && p.brick < brickCost) missing.push(`${brickCost} mattoni`);
                if (space.cost.cattle && p.cattle < space.cost.cattle) missing.push(`${space.cost.cattle} bestiame`);
            
                if (isRemote) return false;
                return this.flashError(`Risorse insufficienti! Mancano: ${missing.join(', ')}`);
            }

            p.workers -= workerCost;
            if (coinCost > 0) p.coin -= coinCost;
            if (space.cost.wood) p.wood -= space.cost.wood;
            if (brickCost > 0) p.brick -= brickCost;
            if (space.cost.cattle) p.cattle -= space.cost.cattle;

            if (space.id === 8) {
                if (p.luxury <= 0) {
                    p.workers += workerCost;
                    return isRemote ? false : this.flashError("No Lusso!");
                }
                let amount = p.luxury;
                p.luxury = 0;
                p.vp += (amount * 3);
                this.showFloatingText(space.id, `+${amount*3}🏆`, 'yellow');
                this.recordAction({
                    player_id: p.id,
                    type: 'special',
                    desc: `Palazzo: +${amount * 3} VP`,
                    turn: this.currentPlayerIndex
                });
                this.finalizeMove(space, p, advanceTurn);
                return true;
            }

            if (space.id === 15) {
                let baseReward = Math.max(1, 3 - this.marketUsage);
                p.coin += baseReward;
                this.marketUsage++;
                if (space.reward.luxury) p.luxury++;
                this.visualizeReward(space.id, 'coin', baseReward);
                if (space.reward.luxury) this.visualizeReward(space.id, 'luxury', 1);
                this.finalizeMove(space, p, advanceTurn);
                return true;
            }

            if (space.reward.special) {
                const sp = space.reward.special;
                if (p.isHuman && !isRemote && ['piazza','monastero','taverna','accampamento','gogna'].includes(sp)) {
                    this.pendingSpace = space;
                    this.openSpecialModal(sp, p, choiceData);
                    return true;
                }
                this.applySpecialReward(space.reward.special, p, space.id, choiceData);
            } else {
                for (let k in space.reward) {
                    if (k === 'special') continue;
                    let qty = space.reward[k];
                    if (this.currentEvent?.id === 'war' && space.id === 3 && k === 'infantry') qty += 1;
                    if (typeof p[k] !== 'undefined') p[k] += qty;
                    else if (k === 'newWorker') p.futureWorkers += qty;
                    else if (k === 'firstPlayer') p.getIndicator = true;
                    if (p.isHuman) this.visualizeReward(space.id, k, qty);
                }
            }

            this.finalizeMove(space, p, advanceTurn);
            return true;
        }

        /**
         * APPLY REMOTE MOVE
         * Applica una mossa ricevuta dal database.
         */
          applyRemoteMove(move) {
            if (this.isGameOver) return;
            const player = this.players[move.player_id];
            if (!player) return;
        
            const isResolutionMove = ['stronghold_deposit', 'build_choice'].includes(move.move_type);
            const isTurnBasedMove = ['space', 'tech', 'copy_tech', 'pass'].includes(move.move_type);
        
            if (this.isMultiplayer && isTurnBasedMove && !isResolutionMove) {
                const moveRound = move.round !== undefined ? move.round : this.round;
                const moveTurn = move.turn !== undefined ? move.turn : this.currentPlayerIndex;
        
                // Mossa passata: applica senza far avanzare il turno
                if (moveRound < this.round || (moveRound === this.round && moveTurn < this.currentPlayerIndex)) {
                    if (move.move_type === 'space') {
                        this.executeAction(player, move.space_id, true, move.choiceData || null, false);
                    } else if (move.move_type === 'tech') {
                        this.executeTech(player, move.tech_idx, true, false);
                    } else if (move.move_type === 'copy_tech') {
                        const originalTech = this.currentTechs[move.tech_idx];
                        if (originalTech && originalTech.takenBy === null) {
                            const target = this.currentTechs.find(t => t.id === move.copied_tech_id);
                            if (target && typeof target.effect === 'function') target.effect(player, this);
                            originalTech.takenBy = player.id;
                            player.techUsed = true;
                            this.log(`${player.name} copia ${target ? target.text : ''}`);
                            this.recordAction({
                                player_id: player.id,
                                type: 'tech',
                                tech_idx: move.tech_idx,
                                desc: `Copia Tech: ${target ? target.text : ''}`,
                                turn: moveTurn
                            });
                        }
                    }
                    return;
                }

                // Mossa futura: accoda (con controllo unicità)
                if (moveRound > this.round || (moveRound === this.round && moveTurn > this.currentPlayerIndex)) {
                    if (!this.pendingMoves.some(m => m.client_move_id === move.client_move_id)) {
                        this.pendingMoves.push(move);
                    }
                    return;
                }
            }
        
            switch (move.move_type) {
                case 'space':
                    this.executeAction(player, move.space_id, true, move.choiceData || null, true);
                    break;
        
                case 'tech':
                    this.executeTech(player, move.tech_idx, true, true);
                    break;
        
                case 'copy_tech': {
                    const originalTech = this.currentTechs[move.tech_idx];
                    if (!originalTech || originalTech.takenBy !== null) break;
        
                    const target = this.currentTechs.find(t => t.id === move.copied_tech_id);
                    if (target && typeof target.effect === 'function') {
                        target.effect(player, this);
                    }
        
                    originalTech.takenBy = player.id;
                    player.techUsed = true;
                    this.log(`${player.name} copia ${target ? target.text : ''}`);
                    this.recordAction({
                        player_id: player.id,
                        type: 'tech',
                        tech_idx: move.tech_idx,
                        desc: `Copia Tech: ${target ? target.text : ''}`,
                        turn: this.currentPlayerIndex
                    });
                    this.nextTurn();
                    break;
                }
        
                case 'pass':
                    if (!player.passed) {
                        player.passed = true;
                        this.log(`${player.name} passa.`);
                        this.recordAction({
                            player_id: player.id,
                            type: 'pass',
                            desc: 'Passa',
                            turn: this.currentPlayerIndex
                        });
                        this.nextTurn();
                    }
                    break;
        
                case 'stronghold_deposit': {
                    // GUARDIA CONTESTUALE: la mossa deve corrispondere all'elemento corrente della coda
                    const currentEntry = this.resolutionQueue[this.resolutionIndex];
                    const isExpected = currentEntry &&
                                       currentEntry.type === 'stronghold' &&
                                       currentEntry.playerId === move.player_id;
                    if (!isExpected) {
                        // Mossa duplicata o fuori contesto: ignora
                        break;
                    }
        
                    const depositAmount = move.infantry || 0;
                    if (depositAmount > 0) {
                        player.stronghold.infantry += depositAmount;
                        player.infantry -= depositAmount;
                    }
        
                    const auto = this.pendingStrongholdAuto || { archer: 0, knight: 0 };
                    const desc = this.getStrongholdDescription(auto, depositAmount);
                    this.log(`${player.name}: ${desc}`);
                    this.recordAction({
                        player_id: player.id,
                        type: 'stronghold',
                        desc,
                        turn: this.currentPlayerIndex
                    });
        
                    // Pulisci il supporto e avanza la coda
                    this.pendingStrongholdAuto = { archer: 0, knight: 0 };
                    this.advanceResolution();
                    break;
                }
        
                case 'build_choice': {
                    // GUARDIA CONTESTUALE: la mossa deve corrispondere all'elemento corrente della coda
                    const currentEntry = this.resolutionQueue[this.resolutionIndex];
                    const isExpected = currentEntry &&
                                       currentEntry.type === 'cantiere' &&
                                       currentEntry.playerId === move.player_id;
                    if (!isExpected) {
                        // Mossa duplicata o fuori contesto: ignora
                        break;
                    }
        
                    const building = NS.NEW_BUILDINGS.find(x => x.id === move.building_id);
                    if (building) {
                        if (building.type === 'blue') {
                            if (player.luxury < 1) break;
                            player.luxury--;
                            player.hasResidence = true;
                        }
                        this.applyBuild(player, building);
                        // Avanza la risoluzione su tutti i client
                        this.advanceResolution();
                    }
                    break;
                }
            }
        }

        /**
         * FLUSH PENDING MOVES
         * Applica le mosse remote in coda per il turno corrente.
         */
        flushPendingMoves() {
            if (this.resolutionPhase) return;
            let applied = false;
            for (let i = this.pendingMoves.length - 1; i >= 0; i--) {
                const move = this.pendingMoves[i];
                if (
                    move.round === this.round &&
                    move.turn === this.currentPlayerIndex &&
                    move.player_id === this.currentPlayerIndex
                ) {
                    this.pendingMoves.splice(i, 1);
                    this.applyRemoteMove(move);
                    applied = true;
                }
            }
            if (applied) {
                this.updateUI();
            }
        }

        /**
         * FINALIZE MOVE
         * Registra l'occupazione dello spazio e passa il turno.
         */
        finalizeMove(space, p, advanceTurn = true) {
            space.slotsOccupied.push(p.id);
            space.usage++;
            this.log(`${p.name} usa ${space.name}`);
            this.globalMoveCounter++;
            if (this.globalMoveCounter % 3 === 0 && space.id !== 201) {
                const porta = this.spaces.find(s => s.id === 201);
                if (porta) this.accumulatedCoinsPorta++;
            }
            // Non registrare qui se lo spazio è speciale: lo farà applySpecialReward
            if (!space.reward || !space.reward.special) {
                this.recordAction({ player_id: p.id, type: 'space', space_id: space.id, desc: space.name, turn: this.currentPlayerIndex });
            }
            if (advanceTurn) {
                this.nextTurn();
            }
        }

        // ===================== TECNOLOGIE =====================

        /**
         * ATTEMPT CLICK TECH
         * Gestisce il click su una tecnologia (solo umano).
         */
        attemptClickTech(techIdx) {
            if (this.isGameOver) return;
            const p = this.players[this.currentPlayerIndex];
            if (!p || !p.isLocal || p.passed) return;
            if (p.id !== this.currentPlayerIndex) return;

            const tech = this.currentTechs[techIdx];
            if (!tech) return;

            if (this.isMultiplayer && this.sendMove) {
                if (!this.validateTechAction(p, techIdx)) return;

                if (tech.id === 2) {
                    const used = this.currentTechs.filter(t => t.takenBy !== null && t.id !== 2);
                    if (used.length > 0 && p.isHuman) {
                        this.showCopyModal(used, p, techIdx);
                        return;
                    }
                }

                this.sendMove({
                    player_id: p.id,
                    move_type: 'tech',
                    tech_idx: techIdx
                });
            } else {
                this.executeTech(p, techIdx);
            }
        }

        /**
         * EXECUTE TECH
         * Assegna una tecnologia al giocatore e ne applica l'effetto.
         */
        executeTech(p, techIdx, isRemote = false, advanceTurn = true) {
            if (p.techUsed) return isRemote ? false : this.flashError("Tech già usata!");
            const tech = this.currentTechs[techIdx];
            if (!tech || tech.takenBy !== null) return isRemote ? false : this.flashError("Già presa!");

            if (tech.id === 2) {
                const used = this.currentTechs.filter(t => t.takenBy !== null && t.id !== 2);
                if (used.length === 0) {
                    if (!isRemote && p.isHuman) alert("Nessuna tech da copiare. +3💰");
                    p.coin += 3;
                    this.recordAction({
                        player_id: p.id,
                        type: 'tech',
                        tech_idx: techIdx,
                        desc: 'Copia Tech: nessuna tech, +3💰',
                        turn: this.currentPlayerIndex
                    });
                } else {
                    if (!isRemote && p.isHuman) {
                        return this.showCopyModal(used, p, techIdx);
                    } else {
                        const target = used[Math.floor(this.rng() * used.length)];
                        target.effect(p, this);
                        this.log(`${p.name} copia (AI) ${target.text}`);
                    }
                }
            } else {
                if (typeof tech.effect === 'function') tech.effect(p, this);
            }

            tech.takenBy = p.id;
            p.techUsed = true;
            this.log(`${p.name} ricerca ${tech.text}`);
            this.recordAction({ player_id: p.id, type: 'tech', tech_idx: techIdx, desc: tech.text, turn: this.currentPlayerIndex });
            if (advanceTurn) {
                this.nextTurn();
            }
            return true;
        }

        /**
         * END GAME
         * Mostra la schermata finale con punteggi e statistiche.
         */
        endGame() {
            this.isGameOver = true;
            this.updateUI();

            let scores = NS.calculateEndGameScores(this);

            const statsDiv = document.getElementById('spaces-stats');
            statsDiv.innerHTML = Object.entries(this.globalSpaceStats)
                .sort((a,b) => b[1].count - a[1].count)
                .map(([k,v]) => `<div class="flex justify-between border-b p-1"><span>${v.name}</span><span class="font-bold">${v.count}</span></div>`)
                .join('');

            const histList = document.getElementById('event-history-list');
            histList.innerHTML = this.eventHistory
                .map(h => `<li class="mb-1 border-b pb-1"><strong>R${h.round} ${h.event.emoji}</strong> ${h.event.name}. ${h.details||''}</li>`)
                .join('');

            let html = `<table class="score-table w-full text-center border-collapse">
                <thead><tr class="text-slate-600 bg-slate-200"><th>#</th><th>Gioc</th><th>Ris</th><th>Fuori</th><th>Dentro</th><th>Dettagli</th><th>TOT</th></tr></thead><tbody>`;
            scores.forEach((s, i) => {
                html += `<tr class="${i===0 ? 'bg-yellow-50' : ''}">
                    <td class="font-bold text-slate-500">${i+1}</td>
                    <td class="font-bold text-left ${s.p.id===0?'text-blue-600':'text-red-600'}">${s.p.name}</td>
                    <td class="text-xs text-left">${s.p.coin}💰 ${s.p.wood}🪵 ${s.p.brick}🧱<br>${s.p.luxury}💎 ${s.p.cattle}🐄</td>
                    <td class="text-xs">${s.p.infantry}⚔️ ${s.p.archer}🏹 ${s.p.knight}🐴</td>
                    <td class="text-xs bg-slate-100 font-bold text-slate-700">${s.p.stronghold.infantry}⚔️ ${s.p.stronghold.archer}🏹 ${s.p.stronghold.knight}🐴</td>
                    <td class="text-xs text-left">Base:${s.base} Res:${s.res} FortB:${s.fortBase}<br>FortM:${s.fortMaj} OutM:${s.outMaj} Set:${s.troopOut}</td>
                    <td class="font-bold text-lg text-green-700">${s.total}</td>
                </tr>`;
            });
            html += `</tbody></table>`;
            document.getElementById('score-breakdown').innerHTML = html;

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
                        <th class="th-ambra">PV</th><th class="th-ambra">1°</th><th class="th-ambra">Resid.</th>
                        <th class="th-pietra">Ris. Base</th><th class="th-pietra">Bestiame</th><th class="th-pietra">Lusso</th>
                        <th class="th-ambra">Fanti</th><th class="th-ambra">Arcieri</th><th class="th-ambra">Cavalieri</th>
                        <th class="th-pietra">Fanti</th><th class="th-pietra">Arcieri</th><th class="th-pietra">Cavalieri</th>
                        <th class="th-ambra">Fanti</th>
                        <th class="th-pietra">Nr. Fanti</th><th class="th-pietra">Nr. Arcieri</th><th class="th-pietra">Coppie PV</th><th class="th-pietra">Cavalieri</th>
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

            // Renderizza lo storico delle azioni
            if (typeof NS.renderActionHistory === 'function') {
                NS.renderActionHistory(this.getActionHistory(), 'action-history-list');
            }
            document.getElementById('end-modal').style.display = 'flex';
        }
    }

    NS.Game = Game;
})();
