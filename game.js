(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    function mulberry32(a) {
        return function() {
            a |= 0; a = a + 0x6D2B79F5 | 0;
            var t = Math.imul(a ^ a >>> 15, 1 | a);
            t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        };
    }

    /**
     * CLASSE GAME
     * Rappresenta l'intera partita e gestisce tutte le meccaniche di gioco.
     */
    class Game {
        constructor(seed) {
            this.seed = (seed !== undefined && seed !== null) ? seed : Math.floor(Math.random() * 1000000);
            this.rng = mulberry32(this.seed);
            
            // Stato dei giocatori
            this.players = [];
            // Numero del round corrente
            this.round = 1;
            this.maxRounds = 7;
            // Indice del giocatore corrente
            this.currentPlayerIndex = 0;
            // Indice del primo giocatore
            this.firstPlayerIndex = 0;
            // Spazi di gioco (base + edifici costruiti)
            this.spaces = [];
            // Tecnologie disponibili nel round corrente
            this.currentTechs = [];
            // Blocco della Torre Guardia (da tech id 20)
            this.watchtowerBlocked = false;
            // Flag di fine partita
            this.isGameOver = false;
            // Log delle azioni
            this.logs = [];
            // Spazio in attesa di risoluzione (per modali speciali)
            this.pendingSpace = null;
            // Statistiche globali utilizzo spazi
            this.globalSpaceStats = {};

            // Evento corrente del round
            this.currentEvent = null;
            // Storico eventi per la schermata finale
            this.eventHistory = [];
            // Coda eventi pre-generata
            this.eventQueue = [];
            // Spazi bloccati dall'evento
            this.lockedSpaces = [];

            // Code di processamento a fine round
            this.strongholdQueue = [];
            this.cantiereQueue = [];

            // Edifici costruiti (lista ID)
            this.builtBuildings = [];
            // Monete accumulate sulla Porta della Città
            this.accumulatedCoinsPorta = 0;
            // Contatore mosse globali per incrementare la Porta
            this.globalMoveCounter = 0;
            // Inflazione del Cantiere
            this.cantiereInflation = 0;
            // Utilizzo del Mercato (per effetto Mercato Nero)
            this.marketUsage = 0;

            // Stato Gogna
            this.gognaTarget = null;
            // Opzioni già usate nella Taverna
            this.tavernaUsedOptions = [];

            // Avvia il gioco
            this.initGame();
        }

        /**
         * RESET GAME
         * Riporta lo stato iniziale e riavvia la partita.
         */
        resetGame() {
            document.getElementById('end-modal').style.display = 'none';
            // Reimposta tutti gli attributi principali
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

            // Pulisce il log visivo
            const el = document.getElementById('game-log');
            if(el) el.innerHTML = '';
            
            this.initGame();
        }

        /**
         * INIZIALIZZAZIONE PARTITA
         * Crea i giocatori, genera la coda eventi, prepara il primo round.
         */
        initGame() {
            // Genera 8 eventi casuali in base alle probabilità
            for(let i=0; i<8; i++) {
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

            // Monete iniziali in base all'ordine di turno
            const startCoins = [1, 2, 3, 4];
            this.firstPlayerIndex = Math.floor(this.rng() * 4);
            const archetypeKeys = ['GENERAL', 'MERCHANT', 'ARCHITECT'];

            // Crea i 4 giocatori (il primo è umano)
            for (let i = 0; i < 4; i++) {
                let coinIdx = (i - this.firstPlayerIndex + 4) % 4;
                let pArchetype = null;
                if (i !== 0) {
                    // Assegna un archetipo casuale all'AI
                    pArchetype = archetypeKeys[Math.floor(this.rng() * archetypeKeys.length)];
                }

                this.players.push({
                    id: i,
                    name: i === 0 ? "Tu" : `PC ${i}`,
                    archetype: pArchetype,
                    isHuman: i === 0,
                    isLocal: false, // Nuovo campo per multiplayer
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
                    initialTurnOrder: coinIdx    // 0 = primo giocatore, 3 = ultimo
                });
            }
            this.currentPlayerIndex = this.firstPlayerIndex;

            // Avvia il primo round
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

            // Reset variabili di round
            this.watchtowerBlocked = false;
            this.lockedSpaces = [];
            this.gognaTarget = null;
            this.tavernaUsedOptions = [];
            this.marketUsage = 0;

            // Aggiorna l'inflazione del Cantiere in base agli utilizzi del round precedente
            if(this.round > 1) {
                const cantiere = this.spaces.find(s => s.id === 17);
                if(cantiere) {
                    this.cantiereInflation += cantiere.slotsOccupied.length;
                    // Limite massimo: 2 mattoni extra, quindi costo totale massimo 4 mattoni
                    if (this.cantiereInflation > 2) {
                        this.cantiereInflation = 2;
                    }
                }
            }

            // Mischia le tecnologie e ne seleziona 4
            const shuffled = [...NS.TECH_DEFINITIONS].sort(() => 0.5 - this.rng());
            this.currentTechs = shuffled.slice(0, 4).map(t => ({ ...t, takenBy: null }));

            // Se è il primo round, inizializza gli spazi base
            if (this.round === 1) {
                this.spaces = JSON.parse(JSON.stringify(NS.BASE_SPACES));
            }
            // Resetta occupazione e utilizzo per ogni spazio
            this.spaces.forEach(s => {
                s.slotsOccupied = [];
                s.usage = 0;
            });

            // Ripristina il Mercato (in caso di eventi precedenti)
            const market = this.spaces.find(s => s.id === 15);
            if (market) {
                market.slots = 1;
                market.reward = { coin: 3 };
                market.name = "Mercato";
                market.short = "+3💰";
                delete market.reward.luxury;
            }

            // Determina l'evento corrente
            if (this.round > 1) {
                this.currentEvent = this.eventQueue[this.round - 2]; // gli eventi partono dal round 2
            } else {
                this.currentEvent = { name: "Inizio Partita", emoji: "🏁" };
            }

            // Registra l'evento nello storico
            this.eventHistory.push({ round: this.round, event: this.currentEvent, details: "" });
            this.log(`${this.currentEvent.emoji} Evento: ${this.currentEvent.name}`);

            // Applica effetti specifici dell'evento
            if (this.currentEvent.id === 'black_market') {
                // Mercato Nero: 3 slot, +1 lusso, nome speciale
                const m = this.spaces.find(s => s.id === 15);
                if (m) {
                    m.slots = 3;
                    m.reward.luxury = 1;
                    m.short = "3->2->1💰 +1💎";
                    m.name = "Mercato Nero";
                }
            } else if (this.currentEvent.id === 'clouds' || this.currentEvent.id === 'famine') {
                // Nuvole o Carestia bloccano un certo numero di spazi casuali
                const candidates = this.spaces
                    .filter(s => s.id !== 2 && s.type !== 'blue')
                    .map(s => s.id);
                // Mischia gli ID
                for (let i = candidates.length - 1; i > 0; i--) {
                    const j = Math.floor(this.rng() * (i + 1));
                    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
                }
                this.lockedSpaces = candidates.slice(0, this.currentEvent.id === 'clouds' ? 5 : 3);
                const lockedNames = this.spaces
                    .filter(s => this.lockedSpaces.includes(s.id))
                    .map(s => s.name)
                    .join(", ");
                this.eventHistory[this.eventHistory.length-1].details = `Bloccati: ${lockedNames}`;
            }

            // Fase di preparazione giocatori
            this.players.forEach(p => {
                // Aggiunge lavoratori futuri (da tech o edifici)
                if (p.futureWorkers > 0) {
                    p.maxWorkers = Math.min(4, p.maxWorkers + p.futureWorkers);
                    p.futureWorkers = 0;
                }
                // Ripristina lavoratori disponibili
                p.workers = p.maxWorkers;
                // Calcola e assegna il reddito
                const income = 1 + Math.floor(p.cattle / 2) + p.incomeModifier;
                p.coin += income;
                // Reset flag turno
                p.passed = false;
                p.techUsed = false;
                p.getIndicator = false;
            });

            // Effetto Carestia: perdita risorse
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

            // Il turno parte dal primo giocatore
            this.currentPlayerIndex = this.firstPlayerIndex;
        }

        /**
         * PASS TURN
         * Il giocatore corrente passa il turno.
         */
        passTurn() {
            if (this.isGameOver) return;
            const p = this.players[this.currentPlayerIndex];
            if (p.passed) return;
            p.passed = true;
            this.log(`${p.name} passa.`);
            this.nextTurn();
        }

        /**
         * NEXT TURN
         * Passa al prossimo giocatore non passato, o termina il round.
         */
        nextTurn() {
            if (this.isGameOver) return;

            // Se tutti hanno passato, fine round
            if (this.players.every(p => p.passed)) {
                this.endRound();
                return;
            }

            // Trova il prossimo giocatore non passato
            let checks = 0;
            do {
                this.currentPlayerIndex = (this.currentPlayerIndex + 1) % 4;
                checks++;
            } while (this.players[this.currentPlayerIndex].passed && checks < 5);

            this.updateUI();
            // Se il nuovo giocatore è AI, esegui la sua mossa dopo un piccolo ritardo
            setTimeout(() => this.checkAiTurn(), 600);
        }

        /**
         * CHECK AI TURN
         * Se il giocatore corrente è un'AI, esegue la sua mossa.
         */
        checkAiTurn() {
            const p = this.players[this.currentPlayerIndex];
            if (!p.isHuman && !p.passed && !this.isGameOver) {
                try {
                    this.aiMove(p);
                } catch (e) {
                    console.error("AI Error:", e);
                    this.passTurn();
                }
            }
        }

        /**
         * END ROUND
         * Prepara le code di processamento per Roccaforte e Cantiere.
         */
        endRound() {
            const fortSpace = this.spaces.find(s => s.id === 7);
            this.strongholdQueue = [...fortSpace.slotsOccupied].reverse();

            const cantiereSpace = this.spaces.find(s => s.id === 17);
            this.cantiereQueue = [...cantiereSpace.slotsOccupied];

            // Processa prima la Roccaforte, poi il Cantiere, poi finalizza il round
            if (this.strongholdQueue.length > 0) {
                this.processStrongholdQueue();
            } else if (this.cantiereQueue.length > 0) {
                this.processCantiereQueue();
            } else {
                this.finalizeRound();
            }
        }

        /**
         * PROCESS STRONGHOLD QUEUE
         * Gestisce il deposito delle truppe nella Roccaforte.
         * Se il giocatore è umano, apre la modale per scegliere quanti fanti depositare.
         * Se AI, decide automaticamente.
         */
        processStrongholdQueue() {
            if (this.strongholdQueue.length === 0) {
                // Passa alla coda del Cantiere
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

            // La fanteria richiede una scelta (solo per umano)
            if (p.infantry > 0) {
                if (p.isHuman) {
                    this.renderStrongholdModal(p);
                } else {
                    // L'AI deposita tutti i fanti con probabilità 80%
                    const putIn = this.rng() > 0.2 ? p.infantry : 0;
                    p.stronghold.infantry += putIn;
                    p.infantry -= putIn;
                    this.log(`${p.name} deposita ${putIn} fanti.`);
                    this.processStrongholdQueue();
                }
            } else {
                this.log(`${p.name} processato in Roccaforte.`);
                this.processStrongholdQueue();
            }
        }

        /**
         * PROCESS CANTIERE QUEUE
         * Gestisce le costruzioni del Cantiere.
         * Se umano, apre la scelta del tipo di edificio; se AI, costruisce automaticamente.
         */
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

        /**
         * FINALIZE ROUND
         * Aggiorna il primo giocatore, le statistiche e passa al round successivo o termina la partita.
         */
        finalizeRound() {
            // Il giocatore con getIndicator diventa primo giocatore
            const tokenClaimer = this.players.find(p => p.getIndicator);
            if (tokenClaimer) {
                this.firstPlayerIndex = tokenClaimer.id;
                this.log(`${tokenClaimer.name} 1° Giocatore.`);
            }

            // Aggiorna statistiche utilizzo spazi
            this.spaces.forEach(s => {
                if(!this.globalSpaceStats[s.id]) {
                    this.globalSpaceStats[s.id] = { name: s.name, count: 0 };
                }
                this.globalSpaceStats[s.id].count += s.usage;
            });

            // Fine partita o nuovo round
            if (this.round >= this.maxRounds) {
                this.endGame();
            } else {
                this.round++;
                this.startRound();
                this.updateUI();
                this.checkAiTurn();
            }
        }

        // ===================== BUILDING SYSTEM =====================

        /**
         * OPEN BUILD TYPE MODAL
         * Mostra la scelta del tipo di edificio da costruire (solo umano).
         */
        openBuildTypeModal() {
            document.getElementById('build-type-modal').style.display = 'flex';
            const p = this.players[0];
            const btnBlue = document.getElementById('btn-build-blue');
            // Disabilita il Residenziale se già posseduto
            if (p.hasResidence) {
                btnBlue.className += " opacity-50 pointer-events-none";
            } else {
                btnBlue.className = btnBlue.className.replace(" opacity-50 pointer-events-none", "");
            }
        }

        /**
         * BACK TO BUILD TYPE
         * Ritorna alla scelta del tipo di edificio dalla lista.
         */
        backToBuildType() {
            document.getElementById('build-list-modal').style.display = 'none';
            document.getElementById('build-type-modal').style.display = 'flex';
        }

        /**
         * OPEN BUILD LIST
         * Mostra la lista degli edifici del tipo selezionato.
         */
        openBuildList(type) {
            document.getElementById('build-type-modal').style.display = 'none';
            const modal = document.getElementById('build-list-modal');
            const container = document.getElementById('build-list-container');
            container.innerHTML = '';

            const title = document.getElementById('build-list-title');
            title.innerText = type === 'vp' ? "Edifici Amministrativi (Gialli)" :
                              (type === 'res' ? "Edifici Produttivi (Verdi)" : "Residenziale (Blu)");

            let list = [];
            if (type === 'blue') {
                list = NS.NEW_BUILDINGS.filter(b => b.type === 'blue');
            } else {
                list = NS.NEW_BUILDINGS.filter(b => b.type === type);
            }

            const p = this.players[0];

            list.forEach(b => {
                const isBuilt = this.builtBuildings.includes(b.id);
                const div = document.createElement('div');
                const canAfford = (b.type !== 'blue' || p.luxury >= 1);
                let extraClass = '';
                let label = '';

                if (isBuilt) {
                    extraClass = 'disabled bg-slate-200 border-slate-300';
                    label = '<span class="text-xs font-bold text-slate-500">[GIÀ COSTRUITO]</span>';
                } else if (!canAfford) {
                    extraClass = 'opacity-50';
                    label = '<div class="text-xs font-bold text-red-500">Manca 1💎</div>';
                }

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

        /**
         * CONFIRM BUILD
         * Conferma la costruzione di un edificio (solo umano).
         */
        confirmBuild(b) {
            const p = this.players[0];
            if (b.type === 'blue') {
                if (p.luxury < 1) return;
                p.luxury--;
                p.hasResidence = true;
            }
            this.applyBuild(p, b);
            document.getElementById('build-list-modal').style.display = 'none';
            this.processCantiereQueue();
        }

        /**
         * APPLY BUILD
         * Aggiunge l'edificio alla lista e crea un nuovo spazio nella plancia.
         */
        applyBuild(p, b) {
            this.log(`${p.name} costruisce: ${b.name}`);
            if (b.type !== 'blue') this.builtBuildings.push(b.id);
            if (b.onBuild) b.onBuild(p);

            // Crea una copia dell'edificio come nuovo spazio
            const newSpace = JSON.parse(JSON.stringify(b));
            newSpace.ownerId = p.id;
            newSpace.slotsOccupied = [];
            newSpace.usage = 0;
            this.spaces.push(newSpace);
        }

        // ===================== AZIONI SPAZIO =====================

        /**
         * ATTEMPT CLICK SPACE
         * Gestisce il click su uno spazio della plancia (solo umano).
         */
        attemptClickSpace(spaceId) {
            if (this.isGameOver) return;
            const p = this.players[this.currentPlayerIndex];
            if (!p.isHuman || p.passed) return;
            this.executeAction(p, spaceId);
        }

        /**
         * EXECUTE ACTION
         * Esegue l'azione su uno spazio: controlla costi, applica ricompense.
         */
        executeAction(p, spaceId) {
            const space = this.spaces.find(s => s.id === spaceId);
            if (!space || space.type === 'blue') return false; // gli spazi residenziali non sono cliccabili

            // ---- Controlli preliminari ----
            let workerCost = space.cost.workerCost || 1;
            if (p.workers < workerCost) return this.flashError("Lavoratori insufficienti!");
            if (space.slots !== 99 && space.slotsOccupied.length >= space.slots) return this.flashError("Spazio pieno!");
            if (space.uniquePlayer && space.slotsOccupied.includes(p.id)) return this.flashError("Sei già qui!");
            if (space.id === 2 && this.watchtowerBlocked) return this.flashError("Bloccato dalla Tech!");
            if (this.lockedSpaces.includes(space.id)) return this.flashError("Bloccato dall'Evento!");
            if (this.gognaTarget === p.id && (space.type === 'mil' || space.id === 2)) return this.flashError("Sei alla Gogna!");

            // Pagamento al proprietario (per edifici costruiti)
            if (space.ownerId !== undefined && space.ownerId !== p.id && space.type !== 'blue') {
                if (p.coin < 1) return this.flashError("Devi 1 moneta al proprietario!");
                p.coin--;
                this.players[space.ownerId].coin++;
                this.log(`${p.name} paga 1💰 a ${this.players[space.ownerId].name}`);
            }

            // ---- Calcolo costi ----
            let coinCost = space.cost.coin || 0;
            if (this.currentEvent && this.currentEvent.id === 'war' && space.type === 'mil') coinCost = Math.max(0, coinCost - 1); // Guerra riduce costo monete militari

            let brickCost = space.cost.brick || 0;
            if (space.id === 17) brickCost += this.cantiereInflation; // Cantiere ha costo extra per inflazione

            // Verifica risorse
            if ((coinCost > 0 && p.coin < coinCost) ||
                (space.cost.wood && p.wood < space.cost.wood) ||
                (brickCost > 0 && p.brick < brickCost) ||
                (space.cost.cattle && p.cattle < space.cost.cattle))
                return this.flashError(`Risorse insufficienti! Cantiere: ${brickCost}🧱`);

            // ---- Sottrai costi ----
            p.workers -= workerCost;
            if (coinCost > 0) p.coin -= coinCost;
            if (space.cost.wood) p.wood -= space.cost.wood;
            if (brickCost > 0) p.brick -= brickCost;
            if (space.cost.cattle) p.cattle -= space.cost.cattle;

            // ---- Gestione spazi speciali particolari ----
            // Palazzo (id 8): scambia tutti i lussi per 3 PV ciascuno
            if (space.id === 8) {
                if (p.luxury <= 0) {
                    p.workers += workerCost; // rimborsa il lavoratore
                    return this.flashError("No Lusso!");
                }
                let amount = p.luxury;
                p.luxury = 0;
                p.vp += (amount * 3);
                this.showFloatingText(space.id, `+${amount*3}🏆`, 'yellow');
                this.finalizeMove(space, p);
                return true;
            }

            // Mercato (id 15): gestione speciale con uso decrescente (Mercato Nero)
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

            // ---- Gestione ricompense speciali ----
            if (space.reward.special) {
                if (p.isHuman) {
                    const sp = space.reward.special;
                    // Se lo speciale richiede una scelta, apri la modale
                    if (['piazza','monastero','taverna','accampamento','gogna'].includes(sp)) {
                        this.pendingSpace = space;
                        this.openSpecialModal(sp, p);
                        return true;
                    }
                }
                // Per AI o speciali senza scelta
                this.applySpecialReward(space.reward.special, p, space.id);
            } else {
                // ---- Ricompense normali ----
                for(let k in space.reward) {
                    if(k === 'special') continue;
                    let qty = space.reward[k];
                    // Effetto Guerra: la Caserma dà +1 fante
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

        /**
         * APPLY SPECIAL REWARD
         * Gestisce gli effetti speciali delle location.
         */
        applySpecialReward(type, p, spaceId) {
            if (type === 'piazza') {
                // +1 moneta per tutti
                p.coin += 1;
                // Per l'IA, applica anche la scelta casuale tra legno e mattone
                if (!p.isHuman) {
                    this.applySpecialRewardAI(type, p, spaceId);
                }
            } else if (type === 'roccaforte') {
                // +1 PV
                p.vp += 1;
                if (p.isHuman) this.showFloatingText(spaceId, `+1🏆`, 'yellow');
            } else if (type === 'porta') {
                // Raccoglie le monete accumulate sulla Porta (condiviso)
                const amt = this.accumulatedCoinsPorta;
                if (amt > 0) {
                    p.coin += amt;
                    this.accumulatedCoinsPorta = 0;
                    this.log(`${p.name} raccoglie ${amt}💰 dalla Porta.`);
                }
            } else if (type === 'consiglio') {
                // Sala del Consiglio: recupero truppe (condiviso)
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
                if (gained.length > 0) this.log(`${p.name} ottiene rinforzi dal Consiglio.`);
            } else if (!p.isHuman) {
                // Per gli altri tipi speciali, la logica è esclusiva dell'IA
                this.applySpecialRewardAI(type, p, spaceId);
            }
        }

        /**
         * FINALIZE MOVE
         * Registra l'occupazione dello spazio, incrementa contatori e passa il turno.
         */
        finalizeMove(space, p) {
            space.slotsOccupied.push(p.id);
            space.usage++;
            this.log(`${p.name} usa ${space.name}`);

            this.globalMoveCounter++;
            // Ogni 3 mosse (non sulla Porta) incrementa le monete sulla Porta
            if (this.globalMoveCounter % 3 === 0 && space.id !== 201) {
                const porta = this.spaces.find(s => s.id === 201);
                if (porta) this.accumulatedCoinsPorta++;
            }

            this.nextTurn();
        }

        // ===================== TECNOLOGIE =====================

        /**
         * ATTEMPT CLICK TECH
         * Gestisce il click su una tecnologia (solo umano).
         */
        attemptClickTech(techIdx) {
            if (this.isGameOver) return;
            const p = this.players[this.currentPlayerIndex];
            if (!p.isHuman || p.passed) return;
            this.executeTech(p, techIdx);
        }

        /**
         * EXECUTE TECH
         * Assegna una tecnologia al giocatore e ne applica l'effetto.
         */
        executeTech(p, techIdx) {
            if (p.techUsed) return this.flashError("Tech già usata!");
            const tech = this.currentTechs[techIdx];
            if (!tech || tech.takenBy !== null) return this.flashError("Già presa!");

            // Tech speciale "Copia Tech"
            if (tech.id === 2) {
                const used = this.currentTechs.filter(t => t.takenBy !== null && t.id !== 2);
                if(used.length === 0) {
                    if(p.isHuman) alert("Nessuna tech da copiare. +3💰");
                    p.coin += 3;
                } else {
                    if(p.isHuman) {
                        return this.showCopyModal(used, p, techIdx);
                    } else {
                        const target = used[Math.floor(this.rng() * used.length)];
                        target.effect(p, this);
                        this.log(`${p.name} copia (AI) ${target.text}`);
                    }
                }
            } else {
                if(typeof tech.effect === 'function') tech.effect(p, this);
            }

            tech.takenBy = p.id;
            p.techUsed = true;
            this.log(`${p.name} ricerca ${tech.text}`);
            this.nextTurn();
            return true;
        }

        /**
         * END GAME
         * Mostra la schermata finale con punteggi e statistiche.
         */
        endGame() {
            this.isGameOver = true;
            this.updateUI();

            // Ottiene i punteggi dettagliati dal modulo endgamecalc
            let scores = NS.calculateEndGameScores(this);

            // Statistiche utilizzo spazi
            const statsDiv = document.getElementById('spaces-stats');
            statsDiv.innerHTML = Object.entries(this.globalSpaceStats)
                .sort((a,b) => b[1].count - a[1].count)
                .map(([k,v]) => `<div class="flex justify-between border-b p-1"><span>${v.name}</span><span class="font-bold">${v.count}</span></div>`)
                .join('');

            // Storico eventi
            const histList = document.getElementById('event-history-list');
            histList.innerHTML = this.eventHistory
                .map(h => `<li class="mb-1 border-b pb-1"><strong>R${h.round} ${h.event.emoji}</strong> ${h.event.name}. ${h.details||''}</li>`)
                .join('');

            // Tabella punteggi principale
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

            // Tabella dettagli punteggi
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

            // Mostra la modale finale
            document.getElementById('end-modal').style.display = 'flex';
        }
    }

    // Espone la classe Game nel namespace
    NS.Game = Game;
})();
