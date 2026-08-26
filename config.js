(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    NS.EVENTS = [
        { id: 'famine', name: "Carestia", emoji: "💀", prob: 0.20 },
        { id: 'war', name: "Guerra Imminente", emoji: "⚔️", prob: 0.20 },
        { id: 'black_market', name: "Mercato Nero", emoji: "⚖️", prob: 0.10 },
        { id: 'sun', name: "Sole Splendente", emoji: "☀️", prob: 0.20 },
        { id: 'clouds', name: "Nuvole Dappertutto", emoji: "☁️", prob: 0.30 }
    ];

    NS.ARCHETYPES = {
        GENERAL: { icon: '⚔️', name: 'Generale', color: 'text-red-500' },
        MERCHANT: { icon: '⚖️', name: 'Mercante', color: 'text-amber-500' },
        ARCHITECT: { icon: '🏗️', name: 'Architetto', color: 'text-emerald-500' }
    };

    // Colori dei giocatori (usati per pallini, badge, token)
    NS.PLAYER_COLORS = {
        0: '#2563eb', // blu
        1: '#dc2626', // rosso
        2: '#16a34a', // verde
        3: '#ca8a04'  // giallo/ocra
    };

    NS.BASE_SPACES = [
        { id: 2, name: "Torre di Guardia", type: 'special', cost: {}, reward: { firstPlayer: true }, slots: 1, short: "Prendi 1°" },
        { id: 7, name: "Roccaforte", type: 'special', cost: { coin: 1 }, reward: { special: 'roccaforte', vp: 1 }, slots: 4, uniquePlayer: true, short: "1💰 ➔ +1🏆. Deposita 🏰" },
        { id: 201, name: "Porta della Città", type: 'special', cost: {}, reward: { special: 'porta', infantry: 1 }, slots: 1, short: "Prendi monete qui +1⚔️" },
        { id: 12, name: "Municipio", type: 'special', cost: { workerCost: 2, coin: 1 }, reward: { newWorker: 1 }, slots: 3, short: "1💰 2👷 ➔ +1👷 (Futuro)" },
        { id: 8, name: "Palazzo", type: 'vp', cost: { coin: 2 }, reward: { special: 'palazzo' }, slots: 2, short: "2💰 Paga TUTTI 💎 ➔ 3🏆 cad." },
        { id: 14, name: "Sartoria", type: 'vp', cost: { coin: 3 }, reward: { luxury: 1 }, slots: 2, short: "3💰 ➔ 1💎" },
        { id: 17, name: "Cantiere", type: 'vp', cost: { brick: 2, coin: 1 }, reward: { vp: 3 }, slots: 2, short: "1💰 2🧱++ ➔ 3🏆 + Costruisci" },
        { id: 10, name: "Falegnameria", type: 'res', cost: {}, reward: { wood: 2 }, slots: 1, short: "+2🪵" },
        { id: 11, name: "Genio Civile", type: 'res', cost: {}, reward: { brick: 2 }, slots: 1, short: "+2🧱" },
        { id: 16, name: "Porcile", type: 'res', cost: {}, reward: { cattle: 3 }, slots: 1, short: "+3🐄" },
        { id: 15, name: "Mercato", type: 'res', cost: {}, reward: { coin: 3 }, slots: 1, short: "+3💰" },
        { id: 22, name: "Fattoria", type: 'res', cost: {}, reward: { cattle: 2, brick: 2 }, slots: 1, short: "+2🐄 +2🧱" },
        { id: 1, name: "Piazza", type: 'res', cost: {}, reward: { special: 'piazza' }, slots: 1, short: "+1💰 (+1 🪵/🧱)" },
        { id: 13, name: "Campi", type: 'res', cost: {}, reward: { cattle: 2, coin: 1 }, slots: 1, short: "+2🐄 +1💰" },
        { id: 18, name: "Pensione", type: 'res', cost: { cattle: 1 }, reward: { wood: 2, brick: 1 }, slots: 1, short: "1🐄 ➔ 2🪵 1🧱" },
        { id: 3, name: "Caserma", type: 'mil', cost: {}, reward: { infantry: 1 }, slots: 2, short: "+1⚔️" },
        { id: 4, name: "Poligono", type: 'mil', cost: { coin: 3, wood: 1 }, reward: { archer: 1 }, slots: 2, short: "3💰 1🪵 ➔ 1🏹" },
        { id: 5, name: "Scuderia", type: 'mil', cost: { cattle: 1, coin: 2, wood: 1 }, reward: { knight: 1 }, slots: 99, short: "1🐄 2💰 1🪵 ➔ 1🐴" }
    ];

    NS.NEW_BUILDINGS = [
        { id: 101, type: 'res', name: "Bottega", cost: {}, reward: { luxury: 3, brick: 5 }, slots: 1, desc: "+3💎 +5🧱", short: "+3💎 +5🧱" },
        { id: 205, type: 'res', name: "Taverna", cost: { coin: 1 }, reward: { special: 'taverna' }, slots: 3, desc: "1💰 -> Scegli Menu (max 1x tipo)", short: "1💰 ➔ Scegli: 3🧱+3🏆 | 2🪵+6🐄 | 1🏹 | 2⚔️+1🏆" },
        { id: 103, type: 'res', name: "Monastero", cost: {}, reward: { special: 'monastero', vp: 3 }, slots: 1, desc: "+3🏆. Scegli 1🪵, 1🧱 o 1🐄", short: "+3🏆. Scegli 1 risorsa" },
        { id: 203, type: 'vp', name: "Sala Consiglio", cost: {}, reward: { vp: 1, special: 'consiglio' }, slots: 1, desc: "+1🏆. Se hai meno truppe in fortezza del leader, guadagni truppe.", short: "+1🏆. Catch-up Truppe" },
        { id: 204, type: 'vp', name: "Cattedrale", cost: { coin: 1 }, reward: { vp: 2 }, slots: 1, desc: "1💰 -> 2🏆", short: "1💰 ➔ 2🏆", onBuild: (p) => p.vp += 2, bonusDesc: "Build: +2🏆" },
        { id: 206, type: 'vp', name: "Accampamento", cost: {}, reward: { special: 'accampamento' }, slots: 2, desc: "Paga risorse -> ottieni truppe", short: "Scambia: 1🪵->1🏆1⚔️ | 1🐄->1🏹 | 1🪵1🐄3💰->2🏆2⚔️1🏹" },
        { id: 207, type: 'vp', name: "Gogna", cost: {}, reward: { vp: 1, special: 'gogna' }, slots: 1, desc: "Blocca Rosso/Torre a avversario.", short: "+1🏆. Blocca avversario." },
        { id: 301, type: 'blue', name: "Residenza", cost: { luxury: 1 }, reward: {}, slots: 0, desc: "Passivo: +6🏆 fine partita.", short: "+6🏆 Fine Partita" }
    ];

    NS.TECH_DEFINITIONS = [
        { id: 1, text: "+1👷 (Prox)", effect: (p, g) => { if(p.maxWorkers < 4) p.futureWorkers++; else p.coin += 3; } },
        { id: 2, text: "Copia Tech", effect: 'copy' },
        { id: 3, text: "+3🧱", effect: (p, g) => p.brick += 3 },
        { id: 4, text: "+3🪵", effect: (p, g) => p.wood += 3 },
        { id: 5, text: "+3💎", effect: (p, g) => p.luxury += 3 },
        { id: 6, text: "+6💰", effect: (p, g) => p.coin += 6 },
        { id: 7, text: "+5⚔️", effect: (p, g) => p.infantry += 5 },
        { id: 8, text: "+2🐴", effect: (p, g) => p.knight += 2 },
        { id: 9, text: "+3🏹", effect: (p, g) => p.archer += 3 },
        { id: 10, text: "+5🏆 (1x)", effect: (p, g) => { if(!p.tech10Used){ p.vp += 5; p.tech10Used=true; } else p.coin+=2; } },
        { id: 11, text: "+1⚔️ +1🐴 +1🏹", effect: (p, g) => { p.infantry++; p.knight++; p.archer++; } },
        { id: 12, text: "+1💰 +1🪵 +2🧱", effect: (p, g) => { p.coin++; p.wood++; p.brick+=2; } },
        { id: 13, text: "+1💰 +1🧱 +2🪵", effect: (p, g) => { p.coin++; p.brick++; p.wood+=2; } },
        { id: 14, text: "+1👷 (ORA)", effect: (p, g) => p.workers++ },
        { id: 15, text: "+3🐄", effect: (p, g) => p.cattle += 3 },
        { id: 16, text: "+1🐄 +1⚔️ +1🪵", effect: (p, g) => { p.cattle++; p.infantry++; p.wood++; } },
        { id: 17, text: "+1🐄 +1⚔️ +1🧱", effect: (p, g) => { p.cattle++; p.infantry++; p.brick++; } },
        { id: 18, text: "+1🐄 +3💰", effect: (p, g) => { p.cattle++; p.coin+=3; } },
        { id: 19, text: "+1🐄 +1⚔️ +1🏆", effect: (p, g) => { p.cattle++; p.infantry++; p.vp++; } },
        { id: 20, text: "1° Gioc. 👑", effect: (p, g) => { p.getIndicator = true; if(g) g.watchtowerBlocked = true; } }
    ];
    
    // Configurazioni centralizzate dei Punti Vittoria delle maggioranze
    NS.MAJORITY_CONFIG = {
        // Maggioranze dentro la Roccaforte
        stronghold_in: {
            infantry: { first: 7, second: 4, tieFirst: 5, tieSecond: 4 },
            archer:   { first: 9, second: 5, tieFirst: 7, tieSecond: 5 },
            knight:   { first: 12, second: 6, tieFirst: 9, tieSecond: 6 }
        },
        // Maggioranza truppe fuori dalla Roccaforte (solo Fanteria)
        stronghold_out: {
            infantry: { first: 6, second: 3, tieFirst: 4, tieSecond: 3 }
        }
    };
    
})();
