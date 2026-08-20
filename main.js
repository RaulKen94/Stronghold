window.onerror = function(message, source, lineno, colno, error) {
    alert('Errore JavaScript:\n' + message + '\nFile: ' + source + '\nRiga: ' + lineno);
    return true;
};

(function() {
    window.Roccaforte = window.Roccaforte || {};
    var NS = window.Roccaforte;

    window.showMainMenu();
})();
