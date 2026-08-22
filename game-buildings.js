/**
 * GAME-BUILDINGS.JS
 * Gestione della costruzione degli edifici (validazione, modali, applicazione).
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;
    if (!NS.Game) return;

    /**
     * VALIDATE BUILD ACTION
     * Verifica se il giocatore può costruire l'edificio selezionato.
     */
    NS.Game.prototype.validateBuildAction = function(p, b) {
        if (b.type === 'blue' && p.luxury < 1) {
            return false;
        }
        return true;
    };

    /**
     * OPEN BUILD TYPE MODAL
     * Mostra la scelta del tipo di edificio da costruire.
     */
    NS.Game.prototype.openBuildTypeModal = function(p = null) {
        if (!p) p = this.pendingBuildPlayer || this.players[0];
        this.pendingBuildPlayer = p;
        document.getElementById('build-type-modal').style.display = 'flex';
        const btnBlue = document.getElementById('btn-build-blue');
        if (p.hasResidence) btnBlue.className += " opacity-50 pointer-events-none";
        else btnBlue.className = btnBlue.className.replace(" opacity-50 pointer-events-none", "");
    };

    /**
     * BACK TO BUILD TYPE
     * Ritorna alla scelta del tipo di edificio dalla lista.
     */
    NS.Game.prototype.backToBuildType = function() {
        document.getElementById('build-list-modal').style.display = 'none';
        document.getElementById('build-type-modal').style.display = 'flex';
    };

    /**
     * OPEN BUILD LIST
     * Mostra la lista degli edifici del tipo selezionato.
     */
    NS.Game.prototype.openBuildList = function(type) {
        const p = this.pendingBuildPlayer || this.players[0];
        document.getElementById('build-type-modal').style.display = 'none';
        const modal = document.getElementById('build-list-modal');
        const container = document.getElementById('build-list-container');
        container.innerHTML = '';
        const title = document.getElementById('build-list-title');
        title.innerText = type === 'vp' ? "Edifici Amministrativi (Gialli)" :
                          (type === 'res' ? "Edifici Produttivi (Verdi)" : "Residenziale (Blu)");

        let list = [];
        if (type === 'blue') list = NS.NEW_BUILDINGS.filter(b => b.type === 'blue');
        else list = NS.NEW_BUILDINGS.filter(b => b.type === type);

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
            if (!isBuilt) div.onclick = () => this.confirmBuild(b);
            container.appendChild(div);
        });
        modal.style.display = 'flex';
    };

    /**
     * CONFIRM BUILD
     * Conferma la costruzione di un edificio.
     */
    NS.Game.prototype.confirmBuild = function(b) {
        const p = this.pendingBuildPlayer || this.players[0];

        if (!this.validateBuildAction(p, b)) {
            alert('Non hai le risorse necessarie per costruire questo edificio.');
            return;
        }

        if (this.isMultiplayer && this.sendMove) {
            this.sendMove({
                player_id: p.id,
                move_type: 'build_choice',
                building_id: b.id
            });
            document.getElementById('build-list-modal').style.display = 'none';
            this.pendingBuildPlayer = null;
        } else {
            if (b.type === 'blue') {
                p.luxury--;
                p.hasResidence = true;
            }
            this.applyBuild(p, b);
            document.getElementById('build-list-modal').style.display = 'none';
            this.processCantiereQueue();
        }
    };

    /**
     * APPLY BUILD
     * Aggiunge l'edificio alla lista e crea un nuovo spazio nella plancia.
     */
    NS.Game.prototype.applyBuild = function(p, b) {
        this.log(`${p.name} costruisce: ${b.name}`);
        if (b.type !== 'blue') this.builtBuildings.push(b.id);
        if (b.onBuild) b.onBuild(p);
        const newSpace = JSON.parse(JSON.stringify(b));
        newSpace.ownerId = p.id;
        newSpace.slotsOccupied = [];
        newSpace.usage = 0;
        this.spaces.push(newSpace);
        this.recordAction({
            player_id: p.id,
            type: 'build',
            building_id: b.id,
            desc: b.name,
            turn: this.currentPlayerIndex
        });
    };
})();
