/**
 * EXPORT.JS - v1.0.0
 * Gestisce l'esportazione dei risultati di fine partita in formato Excel (TSV).
 */
(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    NS.exportGameResults = function() {
        const game = window.game;
        if (!game) {
            alert("Nessuna partita attiva da esportare.");
            return;
        }

        // Intestazione 16 colonne per Excel / Pivot
        const headers = [
            "Nr. Movimento",
            "Nr. Round",
            "Nr. Azione",
            "Tipo riga",
            "Giocatore",
            "Descrizione",
            "Posizione in classifica",
            "Giocatore in classifica",
            "Risorse",
            "Truppe fuori",
            "Truppe dentro",
            "Dettagli",
            "Totale Punteggio",
            "Codice Lobby",
            "Esportato da",
            "Data e Ora esportazione"
        ];

        // Dati di contesto per giocatore locale, codice lobby e timestamp
        const localPlayer = game.players ? game.players.find(p => p.isLocal) : null;
        const exportedBy = localPlayer ? localPlayer.name : (NS.currentLobbyData?.playerName || 'Giocatore');
        const roomCode = (game.isMultiplayer && NS.currentLobbyData?.roomCode) 
            ? NS.currentLobbyData.roomCode 
            : 'SINGLEPLAYER';

        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const exportTimestamp = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

        const rows = [headers.join('\t')];
        let movCounter = 1;

        const maxRound = game.round || 7;
        const history = game.getActionHistory ? game.getActionHistory() : [];
        const eventHist = game.eventHistory || [];

        // Generazione cronologica round per round
        for (let r = 1; r <= maxRound; r++) {
            // 1. RIGA EVENTO (Inizio Round)
            const evtObj = eventHist.find(e => e.round === r);
            if (evtObj) {
                const evtName = evtObj.event ? evtObj.event.name : 'Evento';
                const evtDesc = evtName + (evtObj.details ? `. ${evtObj.details}` : '');
                
                rows.push([
                    movCounter++,      // 1. Nr. Movimento
                    r,                 // 2. Nr. Round
                    "",                // 3. Nr. Azione
                    "Evento",          // 4. Tipo riga
                    "",                // 5. Giocatore
                    evtDesc,           // 6. Descrizione
                    "",                // 7. Posizione in classifica
                    "",                // 8. Giocatore in classifica
                    "",                // 9. Risorse
                    "",                // 10. Truppe fuori
                    "",                // 11. Truppe dentro
                    "",                // 12. Dettagli
                    "",                // 13. Totale Punteggio
                    roomCode,          // 14. Codice Lobby
                    exportedBy,        // 15. Esportato da
                    exportTimestamp    // 16. Data e Ora esportazione
                ].join('\t'));
            }

            // 2. RIGHE AZIONI DEL ROUND
            const roundActions = history.filter(a => a.round === r);
            roundActions.forEach((act, actIdx) => {
                let rowType = 'Normale';
                if (act.type === 'stronghold') {
                    rowType = 'Fortezza';
                } else if (act.type === 'build' || act.type === 'cantiere') {
                    rowType = 'Cantiere';
                }

                const defaultPName = act.playerName || (game.players[act.player_id] ? game.players[act.player_id].name : `P${act.player_id}`);
                const rawDesc = act.desc || act.type || '';
                const fullMsg = act.playerName ? `${act.playerName}: ${rawDesc}` : `${defaultPName}: ${rawDesc}`;

                let extractedPlayer = defaultPName;
                let extractedDesc = rawDesc;

                // Parsing basato sul primo ":" da sinistra
                if (fullMsg.includes(':')) {
                    const colonIndex = fullMsg.indexOf(':');
                    extractedPlayer = fullMsg.substring(0, colonIndex).trim();
                    extractedDesc = fullMsg.substring(colonIndex + 1).trim();
                }

                // Rimuove eventuali emoji dal nome del giocatore per pulizia dati
                extractedPlayer = extractedPlayer.replace(/[\u1F600-\u1F64F\u1F300-\u1F5FF\u1F680-\u1F6FF\u2600-\u26FF\u2700-\u27BF]/g, '').trim();

                rows.push([
                    movCounter++,      // 1. Nr. Movimento
                    r,                 // 2. Nr. Round
                    actIdx + 1,        // 3. Nr. Azione
                    rowType,           // 4. Tipo riga
                    extractedPlayer,   // 5. Giocatore
                    extractedDesc,     // 6. Descrizione
                    "",                // 7. Posizione in classifica
                    "",                // 8. Giocatore in classifica
                    "",                // 9. Risorse
                    "",                // 10. Truppe fuori
                    "",                // 11. Truppe dentro
                    "",                // 12. Dettagli
                    "",                // 13. Totale Punteggio
                    roomCode,          // 14. Codice Lobby
                    exportedBy,        // 15. Esportato da
                    exportTimestamp    // 16. Data e Ora esportazione
                ].join('\t'));
            });
        }

        // 3. RIGHE DI PUNTEGGIO FINALE (4 righe ordinate dal 1° al 4°)
        let scores = [];
        if (typeof NS.calculateEndGameScores === 'function') {
            scores = NS.calculateEndGameScores(game);
        }

        scores.forEach((s, idx) => {
            const p = s.p;
            const resStr = `${p.coin}-${p.wood}-${p.brick}-${p.luxury}-${p.cattle}`;
            const outTroops = `${p.infantry}-${p.archer}-${p.knight}`;
            const inTroops = `${p.stronghold.infantry}-${p.stronghold.archer}-${p.stronghold.knight}`;
            const detailsStr = `${s.baseVp}-${s.baseFirst}-${s.baseResidence}-${s.res}-${s.fortBase}-${s.fortMaj}-${s.outMaj}-${s.troopOut}`;

            rows.push([
                movCounter++,          // 1. Nr. Movimento
                maxRound,              // 2. Nr. Round
                "",                    // 3. Nr. Azione
                "Punteggio",           // 4. Tipo riga
                "",                    // 5. Giocatore
                "",                    // 6. Descrizione
                idx + 1,               // 7. Posizione in classifica
                p.name,                // 8. Giocatore in classifica
                resStr,                // 9. Risorse
                outTroops,             // 10. Truppe fuori
                inTroops,              // 11. Truppe dentro
                detailsStr,            // 12. Dettagli
                s.total,               // 13. Totale Punteggio
                roomCode,              // 14. Codice Lobby
                exportedBy,            // 15. Esportato da
                exportTimestamp        // 16. Data e Ora esportazione
            ].join('\t'));
        });

        // Testo TSV formattato con tabulazioni per Excel
        const tsvData = rows.join('\n');

        // Scrittura negli appunti e feedback sul pulsante
        navigator.clipboard.writeText(tsvData).then(() => {
            const btn = document.getElementById('btn-export-results');
            if (btn) {
                const originalText = btn.innerHTML;
                btn.innerHTML = '📑 Copiato! ✓';
                btn.classList.add('bg-green-700');
                setTimeout(() => {
                    btn.innerHTML = originalText;
                    btn.classList.remove('bg-green-700');
                }, 3000);
            }
        }).catch(err => {
            console.error('Errore copia negli appunti:', err);
            alert('Impossibile copiare i dati negli appunti.');
        });
    };

    window.exportGameResults = NS.exportGameResults;
})();
