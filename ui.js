(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.Game) return;

    NS.Game.prototype.updateUI = function() {
        document.getElementById('round-display').innerText = this.round;
        const curr = this.players[this.currentPlayerIndex];
        const turnDiv = document.getElementById('turn-indicator');
        turnDiv.innerText = `${curr.isHuman ? 'Tocca a TE' : curr.name}`;
        turnDiv.className = `px-2 py-1 rounded-full font-bold text-[10px] shadow-md border transition-all ${curr.id===0 ? 'bg-blue-600 border-blue-400 text-white animate-pulse' : 'bg-slate-600 border-slate-500 text-slate-300'}`;
        
        let evHtml = this.currentEvent ? `<div class="font-bold text-white flex items-center gap-2"><span>${this.currentEvent.emoji}</span><span>${this.currentEvent.name}</span></div>` : '';

        let nextEventHtml = '';
        if (this.round < this.maxRounds) {
            const ne = this.eventQueue[this.round - 1]; 
            nextEventHtml = `<div class="next-event-pill"><span class="uppercase font-bold text-[9px] text-slate-400">Prox:</span><span>${ne.emoji}</span><span>${ne.name}</span></div>`;
        } else {
            nextEventHtml = `<div class="next-event-pill"><span>🏁</span><span>Fine Partita</span></div>`;
        }
        
        const combinedHtml = `<div class="combined-event-banner">${evHtml}${nextEventHtml}</div>`;

        const deskContainer = document.getElementById('active-event-display');
        if(deskContainer) deskContainer.innerHTML = combinedHtml;
        
        const mobContainer = document.getElementById('mobile-event-banner');
        if(mobContainer) mobContainer.innerHTML = combinedHtml;

        const tCont = document.getElementById('tech-container'); tCont.innerHTML = '';
        const human = this.players[0];
        const getTechNote = (t) => {
            if (t.id === 1) return human.maxWorkers >= 4 ? 'Hai già 4 lavoratori → +3💰' : 'Al prossimo turno: +1👷';
            if (t.id === 2) {
                const anyUsed = this.currentTechs.some(x => x.takenBy !== null && x.id !== 2);
                return anyUsed ? 'Copia una tecnologia già presa' : 'Nessuna tech da copiare → +3💰';
            }
            if (t.id === 10) return human.tech10Used ? 'Già usata in precedenza → +2💰' : 'Prima volta: +5🏆';
            if (t.id === 14) return 'Solo per il turno corrente: +1👷 (max 4, poi torna a 4)';
            return '';
        };

        this.currentTechs.forEach((t, i) => {
            const div = document.createElement('div');
            div.className = `tech-card ${t.takenBy !== null ? 'taken' : ''}`;
            if (t.takenBy === null) {
                const note = getTechNote(t);
                div.innerHTML = `<span class="font-bold block mb-1 text-center">${t.text}</span>` +
                                (note ? `<span class="block text-[9px] text-indigo-200 text-center mt-1">${note}</span>` : '');
                div.onclick = () => this.attemptClickTech(i);
            } else {
                const owner = this.players[t.takenBy];
                div.innerHTML = `<span class="text-[9px] block text-indigo-200 uppercase tracking-widest text-center">Presa da</span><span class="font-bold text-center block text-white">${owner.name}</span>`;
            }
            tCont.appendChild(div);
        });
        
        const bCont = document.getElementById('board-container'); bCont.innerHTML = '';
        this.spaces.forEach(s => {
            const isFull = (s.slots!==99 && s.slotsOccupied.length>=s.slots);
            const blocked = (s.id===2 && this.watchtowerBlocked);
            const eventLocked = this.lockedSpaces.includes(s.id);
            const isResidential = s.type === 'blue';
            
            const div = document.createElement('div');
            div.className = `action-space ${isFull||blocked?'full':''} ${(blocked)?'disabled':''} ${eventLocked?'event-locked':''} ${isResidential?'residential':''}`;
            div.dataset.type = s.type;

            let slotHtml = '';
            if(!isResidential) {
                s.slotsOccupied.forEach(pid => slotHtml += `<div class="worker-slot token-p${pid}">${pid===0?'★':''}</div>`);
                if(s.slots!==99) for(let i=0; i<(s.slots - s.slotsOccupied.length); i++) slotHtml += `<div class="worker-slot bg-white/20 border-slate-400/20"></div>`;
                else slotHtml += `<span class="text-xl">∞</span>`;
            } else { slotHtml = '<div class="text-center w-full font-bold opacity-70">Privato</div>'; }

            let costHtml = '';
            if(s.cost.workerCost > 1) costHtml += `<span class="res-pill text-red-700 bg-red-100 border border-red-200">2👷</span>`;
            let coinCost = s.cost.coin || 0;
            const isOwner = s.ownerId === 0;
            if(s.ownerId !== undefined && !isOwner && !isResidential) coinCost += 1;
            
            if (this.currentEvent?.id === 'war' && s.type === 'mil') coinCost = Math.max(0, coinCost - 1);
            if(coinCost > 0) costHtml += `<span class="res-pill">-${coinCost}💰</span>`;
            
            let brickCost = s.cost.brick || 0;
            if(s.id === 17 && this.cantiereInflation > 0) brickCost += this.cantiereInflation;
            
            if(brickCost > 0) costHtml += `<span class="res-pill">-${brickCost}🧱</span>`;
            if(s.cost.wood) costHtml += `<span class="res-pill">-${s.cost.wood}🪵</span>`;
            if(s.cost.cattle) costHtml += `<span class="res-pill">-${s.cost.cattle}🐄</span>`;
            if(s.cost.special && s.id !== 8) costHtml += `<span class="res-pill text-purple-700 font-bold">Spec.</span>`;

            let badgeHtml = '';
            if (this.currentEvent?.id === 'war' && s.id === 3) badgeHtml += '<div class="absolute -top-2 -right-2 bg-red-600 text-white rounded-full w-6 h-6 flex items-center justify-center font-bold shadow-md border-2 border-white z-10 war-badge">+1⚔️</div>';
            if (s.ownerId !== undefined) {
                const ownerColor = s.ownerId === 0 ? '#2563eb' : (s.ownerId===1?'#dc2626':(s.ownerId===2?'#16a34a':'#ca8a04'));
                badgeHtml += `<div class="owner-badge" style="background:${ownerColor};" title="Proprietario: ${this.players[s.ownerId].name}">${s.ownerId===0?'★':('P'+s.ownerId)}</div>`;
            }

            if (s.id === 201 && this.accumulatedCoinsPorta > 0) costHtml += `<span class="res-pill bg-yellow-400 text-black border-yellow-600">+${this.accumulatedCoinsPorta}💰 Qui</span>`;

            div.innerHTML = `${badgeHtml}
                <div class="flex justify-between items-start border-b border-black/5 pb-1 mb-1 pointer-events-none">
                    <span class="font-bold text-[10px] uppercase leading-tight tracking-tight">${s.name}</span>
                    <span class="text-[9px] bg-white/50 px-1 rounded-full font-mono text-slate-500">#${s.id}</span>
                </div>
                <div class="text-[10px] leading-tight flex-1 font-medium text-slate-700 pointer-events-none">${s.short}</div>
                <div class="mt-1 pointer-events-none">
                    <div class="text-[9px] mb-1 min-h-[14px] flex flex-wrap gap-1">${costHtml}</div>
                    <div class="flex flex-wrap items-center bg-black/5 p-1 rounded gap-1 min-h-[26px]">${slotHtml}</div>
                </div>`;
            div.onclick = () => this.attemptClickSpace(s.id);
            bCont.appendChild(div);
        });

        // ====== MODIFICHE: controlli di esistenza ======
        const dCont = document.getElementById('desktop-players-container');
        const mCont = document.getElementById('mobile-opponents-list');
        if (dCont) dCont.innerHTML = '';
        if (mCont) mCont.innerHTML = '';

        this.players.forEach(p => {
            const isActive = (p.id === this.currentPlayerIndex && !this.isGameOver);
            const isMe = p.id === 0;
            const income = 1 + Math.floor(p.cattle/2) + p.incomeModifier;
            const arch = p.archetype ? `<span class="${NS.ARCHETYPES[p.archetype].color} ml-1" title="${NS.ARCHETYPES[p.archetype].name}">${NS.ARCHETYPES[p.archetype].icon}</span>` : '';
            
            const htmlContent = `
                <div class="flex justify-between items-center mb-1 pb-1 border-b border-slate-300/30">
                    <span class="font-bold text-xs ${isMe?'text-blue-400':'text-red-400'} flex items-center">${p.name} ${this.firstPlayerIndex===p.id?'👑':''} ${arch}</span>
                    <div class="flex gap-2">
                         <span class="text-[9px] text-slate-400 flex items-center gap-0.5" title="Income">+${income}💰/rnd</span>
                         <span class="text-[9px] bg-slate-700 text-white px-1.5 rounded">🏆${p.vp}</span>
                    </div>
                </div>
                <div class="grid grid-cols-4 gap-y-1 text-[10px] text-center opacity-90">
                    <div>👷${p.workers}</div><div>💰${p.coin}</div><div>🪵${p.wood}</div><div>🧱${p.brick}</div>
                    <div>💎${p.luxury}</div><div>🐄${p.cattle}</div>
                    <div class="col-span-2 text-left pl-2">Mano: ⚔️${p.infantry} 🏹${p.archer} 🐴${p.knight}</div>
                </div>
                <div class="mt-1 text-[10px] font-bold text-slate-500 bg-black/10 rounded px-1 flex justify-between">
                    <span>In Roccaforte (🏰):</span>
                    <span class="text-slate-200">${p.stronghold.infantry}⚔️ ${p.stronghold.archer}🏹 ${p.stronghold.knight}🐴</span>
                </div>
                ${p.passed ? '<div class="text-red-500 font-bold text-center text-[9px] uppercase mt-1">Passato</div>' : ''}
            `;
            const dCard = document.createElement('div');
            dCard.className = `bg-slate-800 p-2 rounded border-l-2 ${isActive?'border-yellow-400 ring-1 ring-yellow-400/20':'border-transparent'} ${p.passed?'opacity-50':''}`;
            dCard.innerHTML = htmlContent;
            if (dCont) dCont.appendChild(dCard);

            const mCard = document.createElement('div');
            mCard.className = `p-2 rounded border ${isMe?'bg-blue-50 border-blue-200':'bg-white border-slate-200'} ${isActive?'ring-2 ring-yellow-400':''}`;
            mCard.innerHTML = htmlContent.replace('text-blue-400','text-blue-700').replace('text-red-400','text-red-700').replace(/text-slate-200/g,'text-slate-800');
            if (mCont) mCont.appendChild(mCard);
        });

        const me = this.players[0]; 
        const mStats = document.getElementById('mobile-my-stats');
        if (mStats) {
            mStats.innerHTML = `<div class="flex items-center gap-1"><span class="text-lg">👷</span><span class="font-bold">${me.workers}</span></div><div class="flex items-center gap-1"><span class="text-lg">💰</span><span class="font-bold">${me.coin}</span></div><div class="flex items-center gap-1"><span class="text-lg">🪵</span><span class="font-bold">${me.wood}</span></div><div class="flex items-center gap-1"><span class="text-lg">🧱</span><span class="font-bold">${me.brick}</span></div><div class="flex items-center gap-1"><span class="text-lg">💎</span><span class="font-bold">${me.luxury}</span></div><div class="flex items-center gap-1"><span class="text-lg">🐄</span><span class="font-bold">${me.cattle}</span></div>`;
        }

        const canPass = (this.currentPlayerIndex === 0 && !me.passed && !this.isGameOver && !me.extraTurn);
        const pBtnM = document.getElementById('btn-pass-mobile'); 
        const pBtnD = document.getElementById('btn-pass-desktop');
        [pBtnM, pBtnD].forEach(btn => { 
            if(btn) { 
                btn.disabled = !canPass; 
                btn.className = canPass ? btn.className.replace('opacity-50 grayscale cursor-not-allowed', '') : btn.className + ' opacity-50 grayscale cursor-not-allowed'; 
            }
        });
        if(window.lucide) lucide.createIcons();
    };

    NS.Game.prototype.showFloatingText = function(spaceId, text, colorType) {
        const els = document.querySelectorAll('.action-space');
        let target = null;
        els.forEach(el => { if(el.innerHTML.includes(`#${spaceId}<`)) target = el; });
        if(!target) return;
        const floatEl = document.createElement('div');
        floatEl.className = `floating-text float-${colorType}`;
        floatEl.innerText = text;
        target.appendChild(floatEl);
        floatEl.style.left = '50%'; floatEl.style.top = '20%';
        setTimeout(() => floatEl.remove(), 1200);
    };

    NS.Game.prototype.visualizeReward = function(sid, k, qty) {
        if(k==='coin') this.showFloatingText(sid, `+${qty}💰`, 'yellow');
        if(k==='wood') this.showFloatingText(sid, `+${qty}🪵`, 'green');
        if(k==='brick') this.showFloatingText(sid, `+${qty}🧱`, 'green');
        if(k==='cattle') this.showFloatingText(sid, `+${qty}🐄`, 'green');
        if(k==='vp') this.showFloatingText(sid, `+${qty}🏆`, 'yellow');
        if(k==='infantry') this.showFloatingText(sid, `+${qty}⚔️`, 'red');
        if(k==='archer') this.showFloatingText(sid, `+${qty}🏹`, 'red');
        if(k==='knight') this.showFloatingText(sid, `+${qty}🐴`, 'red');
        if(k==='luxury') this.showFloatingText(sid, `+${qty}💎`, 'yellow');
    };

    NS.Game.prototype.openSpecialModal = function(type, p) {
        const modal = document.getElementById('choice-modal');
        const opts = document.getElementById('choice-options');
        opts.innerHTML = '';
        modal.style.display = 'flex';

        if (type === 'piazza' || type === 'pozzo' || type === 'monastero') {
            const choices = [
                {txt: "🪵 Legno", cb: () => { p.wood++; this.finishSpecial(); }},
                {txt: "🧱 Mattone", cb: () => { p.brick++; this.finishSpecial(); }}
            ];
            if(type === 'monastero') choices.push({txt: "🐄 Bestiame", cb: () => { p.cattle++; this.finishSpecial(); }});
            
            choices.forEach(o => this.createChoiceBtn(opts, o.txt, o.cb));
        }
        else if (type === 'taverna') {
            const menu = [
                {id:'A', txt:"🧱+🏆", cb:()=>{p.brick++; p.vp++;}},
                {id:'B', txt:"🪵+🐄", cb:()=>{p.wood++; p.cattle++;}},
                {id:'C', txt:"🏹", cb:()=>{p.archer++;}},
                {id:'D', txt:"⚔️+🏆", cb:()=>{p.infantry++; p.vp++;}}
            ];
            menu.forEach(m => {
                const used = this.tavernaUsedOptions.includes(m.id);
                if (!used) {
                    this.createChoiceBtn(opts, m.txt, () => {
                        m.cb();
                        this.tavernaUsedOptions.push(m.id);
                        this.finishSpecial();
                    });
                }
            });
        }
        else if (type === 'accampamento') {
            this.createChoiceBtn(opts, "Paga 1🪵 -> 1🏆 1⚔️", () => {
                if(p.wood<1) { alert("Manca Legno"); return; }
                p.wood--; p.vp++; p.infantry++; this.finishSpecial();
            });
            this.createChoiceBtn(opts, "Paga 1🐄 -> 1🏹", () => {
                if(p.cattle<1) { alert("Manca Bestiame"); return; }
                p.cattle--; p.archer++; this.finishSpecial();
            });
            this.createChoiceBtn(opts, "Paga 1🪵 1🐄 3💰 -> 2🏆 2⚔️ 1🏹", () => {
                if(p.wood<1 || p.cattle<1 || p.coin<3) { alert("Risorse insufficienti"); return; }
                p.wood--; p.cattle--; p.coin-=3; p.vp+=2; p.infantry+=2; p.archer++; this.finishSpecial();
            });
        }
        else if (type === 'gogna') {
            document.getElementById('choice-modal').style.display = 'none';
            const gModal = document.getElementById('gogna-modal');
            const gOpts = document.getElementById('gogna-options');
            gOpts.innerHTML = '';
            
            this.players.forEach(target => {
                if (target.id !== p.id && target.id !== this.pendingSpace.ownerId) {
                    const btn = document.createElement('button');
                    btn.className = "p-2 bg-red-100 border border-red-500 rounded text-left w-full";
                    const t = target;
                    btn.innerHTML = `<div class="flex justify-between"><strong>${t.name}</strong> <span>🏆${t.vp}</span></div>
                    <div class="text-[10px]">Mano: ${t.infantry+t.archer+t.knight}</div>
                    <div class="text-[10px] text-purple-700">Roccaforte: ${t.stronghold.infantry+t.stronghold.archer+t.stronghold.knight}</div>`;
                    
                    btn.onclick = () => {
                        this.gognaTarget = target.id;
                        this.log(`${p.name} mette alla gogna ${target.name}`);
                        gModal.style.display = 'none';
                        this.finishSpecial();
                    };
                    gOpts.appendChild(btn);
                }
            });
            gModal.style.display = 'flex';
        }
    };

    NS.Game.prototype.createChoiceBtn = function(parent, text, cb) {
        const btn = document.createElement('button');
        btn.className = "bg-blue-600 text-white p-3 rounded font-bold hover:bg-blue-500";
        btn.innerText = text;
        btn.onclick = cb;
        parent.appendChild(btn);
    };

    NS.Game.prototype.finishSpecial = function() {
        document.getElementById('choice-modal').style.display = 'none';
        this.finalizeMove(this.pendingSpace, this.players[this.currentPlayerIndex]);
        this.pendingSpace = null;
    };

    NS.Game.prototype.renderStrongholdModal = function(p) {
        const modal = document.getElementById('stronghold-modal');
        const range = document.getElementById('sh-range');
        const valDisplay = document.getElementById('sh-range-val');
        const tableBody = document.getElementById('stronghold-comparison-body');
        const btn = document.getElementById('btn-confirm-stronghold');

        range.max = p.infantry; range.value = p.infantry; valDisplay.innerText = p.infantry;
        let html = '';
        this.players.forEach(pl => {
            html += `<tr class="${pl.id===p.id?'font-bold bg-blue-50':''}"><td>${pl.name}</td><td>${pl.stronghold.infantry} ⚔️</td><td>${pl.infantry} ⚔️</td></tr>`;
        });
        tableBody.innerHTML = html;
        btn.onclick = () => {
            const val = parseInt(range.value);
            p.stronghold.infantry += val; p.infantry -= val;
            this.log(`Hai depositato ${val} fanti.`);
            modal.style.display = 'none';
            this.processStrongholdQueue();
        };
        modal.style.display = 'flex';
    };

    NS.Game.prototype.flashError = function(msg) { 
        if(this.players[this.currentPlayerIndex].isHuman) alert(msg); 
        return false; 
    };

    NS.Game.prototype.log = function(msg) {
        this.logs.push(msg);
        const el = document.getElementById('game-log');
        if(el) { const line = document.createElement('div'); line.innerText = `> ${msg}`; el.appendChild(line); el.scrollTop = el.scrollHeight; }
        const mobLog = document.getElementById('mobile-log-view');
        if(mobLog) mobLog.innerText = this.logs.slice(-6).map(l => `> ${l}`).join('\n');
    };

    NS.Game.prototype.showCopyModal = function(list, p, idx) {
        const div = document.getElementById('tech-copy-options'); div.innerHTML = '';
        list.forEach(t => {
            const btn = document.createElement('button'); btn.className = "bg-indigo-100 text-indigo-900 p-2 rounded text-left font-bold border border-indigo-300"; btn.innerText = t.text;
            btn.onclick = () => { document.getElementById('tech-copy-modal').style.display = 'none'; t.effect(p, this); this.currentTechs[idx].takenBy = p.id; p.techUsed = true; this.log(`${p.name} copia ${t.text}`); this.nextTurn(); };
            div.appendChild(btn);
        });
        document.getElementById('tech-copy-modal').style.display = 'flex';
        return true;
    };
})();
