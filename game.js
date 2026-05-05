// ============================
// BRAIN GRID - JUEGO PROFESIONAL
// ============================

// --- CONFIGURACIÓN ---
const CONFIG = {
    size: 10,
    cellSize: 32,
    baseCoins: 10,
    countdownTime: 3,      // segundos para memorizar
    maxStars: 3,
    hintCost: 5,
    colors: {
        grid: { fill: '#3b82f6', stroke: '#1d4ed8', glow: 'rgba(59,130,246,0.4)' },
        connect: { fill: '#8b5cf6', stroke: '#6d28d9', glow: 'rgba(139,92,246,0.4)' },
        target: { fill: '#1e293b', stroke: '#0f172a' },
        hint: { fill: '#f59e0b', stroke: '#d97706' },
        bg: '#f8fafc',
        gridLine: '#e2e8f0'
    }
};

// --- ESTADO DEL JUEGO ---
const state = {
    level: 1,
    coins: 0,
    stars: 0,
    mode: 'grid',          // 'grid' | 'connect'
    targetShape: [],
    playerShape: [],
    currentIndex: 0,       // para modo connect
    isMemorizing: false,
    startTime: 0,
    elapsedTime: 0,
    timerInterval: null,
    totalStars: 0
};

// --- REFERENCIAS DOM ---
const els = {
    screens: {
        start: document.getElementById('startScreen'),
        tutorial: document.getElementById('tutorialScreen'),
        game: document.getElementById('gameScreen'),
        win: document.getElementById('winScreen')
    },
    targetCanvas: document.getElementById('targetCanvas'),
    playerCanvas: document.getElementById('playerCanvas'),
    confettiCanvas: document.getElementById('confettiCanvas'),
    countdownOverlay: document.getElementById('countdownOverlay'),
    countdownNumber: document.getElementById('countdownNumber'),
    levelDisplay: document.getElementById('levelDisplay'),
    coinsDisplay: document.getElementById('coinsDisplay'),
    starsDisplay: document.getElementById('starsDisplay'),
    modeBadge: document.getElementById('modeBadge'),
    timerDisplay: document.getElementById('timerDisplay'),
    toast: document.getElementById('toast'),
    winStars: document.getElementById('winStars'),
    winTitle: document.getElementById('winTitle'),
    winCoins: document.getElementById('winCoins'),
    winTime: document.getElementById('winTime'),
    btnPlay: document.getElementById('btnPlay'),
    btnHowTo: document.getElementById('btnHowTo'),
    btnBackFromTutorial: document.getElementById('btnBackFromTutorial'),
    btnVerify: document.getElementById('btnVerify'),
    btnClear: document.getElementById('btnClear'),
    btnHint: document.getElementById('btnHint'),
    btnMenu: document.getElementById('btnMenu'),
    btnNextLevel: document.getElementById('btnNextLevel')
};

const tCtx = els.targetCanvas.getContext('2d');
const pCtx = els.playerCanvas.getContext('2d');
const cCtx = els.confettiCanvas.getContext('2d');

// --- INICIALIZACIÓN DE CANVAS ---
function initCanvas() {
    const w = CONFIG.size * CONFIG.cellSize;
    const h = CONFIG.size * CONFIG.cellSize;
    
    els.targetCanvas.width = w;
    els.targetCanvas.height = h;
    els.playerCanvas.width = w;
    els.playerCanvas.height = h;
    
    // Confetti canvas full screen
    els.confettiCanvas.width = window.innerWidth;
    els.confettiCanvas.height = window.innerHeight;
    
    window.addEventListener('resize', () => {
        els.confettiCanvas.width = window.innerWidth;
        els.confettiCanvas.height = window.innerHeight;
    });
}

// --- NAVEGACIÓN ENTRE PANTALLAS ---
function showScreen(name) {
    Object.values(els.screens).forEach(s => s.classList.remove('active'));
    els.screens[name].classList.add('active');
}

// --- GUARDADO LOCAL ---
function saveGame() {
    try {
        localStorage.setItem('brainGridData', JSON.stringify({
            level: state.level,
            coins: state.coins,
            stars: state.totalStars,
            timestamp: Date.now()
        }));
    } catch (e) {
        console.warn('No se pudo guardar:', e);
    }
}

function loadGame() {
    try {
        const data = JSON.parse(localStorage.getItem('brainGridData'));
        if (data) {
            state.level = data.level || 1;
            state.coins = data.coins || 0;
            state.totalStars = data.stars || 0;
        }
    } catch (e) {
        console.warn('No se pudo cargar:', e);
    }
}

// --- ACTUALIZAR MODO ---
function updateMode() {
    const cycle = Math.floor((state.level - 1) / 5) % 2;
    state.mode = cycle === 0 ? 'grid' : 'connect';
    
    // Actualizar badge
    if (state.mode === 'grid') {
        els.modeBadge.textContent = '🟦 MODO CUADRADOS';
        els.modeBadge.className = 'mode-badge grid';
    } else {
        els.modeBadge.textContent = '🔗 MODO CONECTAR';
        els.modeBadge.className = 'mode-badge connect';
    }
}

// --- DIBUJAR GRID ---
function drawGrid(ctx, highlightCells = []) {
    const w = CONFIG.size * CONFIG.cellSize;
    const h = CONFIG.size * CONFIG.cellSize;
    
    ctx.clearRect(0, 0, w, h);
    
    // Fondo
    ctx.fillStyle = CONFIG.colors.bg;
    ctx.fillRect(0, 0, w, h);
    
    // Líneas de grid
    ctx.strokeStyle = CONFIG.colors.gridLine;
    ctx.lineWidth = 1;
    
    for (let i = 0; i <= CONFIG.size; i++) {
        const pos = i * CONFIG.cellSize;
        ctx.beginPath();
        ctx.moveTo(pos, 0);
        ctx.lineTo(pos, h);
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(0, pos);
        ctx.lineTo(w, pos);
        ctx.stroke();
    }
    
    // Celdas destacadas (hints)
    highlightCells.forEach(p => {
        ctx.fillStyle = 'rgba(245, 158, 11, 0.2)';
        ctx.fillRect(p.x * CONFIG.cellSize, p.y * CONFIG.cellSize, CONFIG.cellSize, CONFIG.cellSize);
    });
}

// --- GENERAR NIVEL ---
function generateLevel() {
    updateMode();
    state.targetShape = [];
    state.playerShape = [];
    state.currentIndex = 0;
    state.isMemorizing = true;
    
    if (state.mode === 'grid') {
        generateGridLevel();
    } else {
        generateConnectLevel();
    }
    
    // Dibujar objetivo
    drawTarget();
    
    // Limpiar jugador
    drawPlayer();
    
    // Iniciar cuenta regresiva
    startCountdown();
}

function generateGridLevel() {
    const used = new Set();
    const count = Math.min(3 + Math.floor(state.level / 2), 25);
    
    while (state.targetShape.length < count) {
        const x = rand();
        const y = rand();
        const key = `${x}-${y}`;
        
        if (!used.has(key)) {
            used.add(key);
            state.targetShape.push({ x, y });
        }
    }
}

function generateConnectLevel() {
    const used = new Set();
    const count = Math.min(4 + Math.floor(state.level / 3), 20);
    
    let x = rand();
    let y = rand();
    
    for (let i = 0; i < count; i++) {
        const key = `${x}-${y}`;
        if (!used.has(key)) {
            used.add(key);
            state.targetShape.push({ x, y });
        }
        
        // Mover a celda adyacente no usada
        let nx, ny, nkey;
        let attempts = 0;
        do {
            const dirs = [[0,1],[0,-1],[1,0],[-1,0]];
            const [dx, dy] = dirs[Math.floor(Math.random() * dirs.length)];
            nx = clamp(x + dx);
            ny = clamp(y + dy);
            nkey = `${nx}-${ny}`;
            attempts++;
        } while (used.has(nkey) && attempts < 20);
        
        if (attempts >= 20) break;
        x = nx;
        y = ny;
    }
}

// --- DIBUJAR OBJETIVO ---
function drawTarget() {
    drawGrid(tCtx);
    
    if (state.mode === 'grid') {
        // Dibujar celdas con sombra y bordes redondeados
        state.targetShape.forEach(p => {
            drawRoundedCell(tCtx, p.x, p.y, CONFIG.colors.target.fill, CONFIG.colors.target.stroke);
        });
    } else if (state.mode === 'connect') {
        // Dibujar puntos con números
        state.targetShape.forEach((p, i) => {
            const cx = p.x * CONFIG.cellSize + CONFIG.cellSize / 2;
            const cy = p.y * CONFIG.cellSize + CONFIG.cellSize / 2;
            
            // Círculo
            tCtx.beginPath();
            tCtx.arc(cx, cy, 6, 0, Math.PI * 2);
            tCtx.fillStyle = CONFIG.colors.target.fill;
            tCtx.fill();
            tCtx.strokeStyle = CONFIG.colors.target.stroke;
            tCtx.lineWidth = 2;
            tCtx.stroke();
            
            // Número
            tCtx.fillStyle = CONFIG.colors.target.stroke;
            tCtx.font = 'bold 11px Nunito';
            tCtx.textAlign = 'center';
            tCtx.textBaseline = 'middle';
            tCtx.fillText(i + 1, cx, cy - 14);
        });
        
        // Líneas entre puntos
        tCtx.strokeStyle = 'rgba(30, 41, 59, 0.3)';
        tCtx.lineWidth = 2;
        tCtx.setLineDash([4, 4]);
        for (let i = 0; i < state.targetShape.length - 1; i++) {
            const a = state.targetShape[i];
            const b = state.targetShape[i + 1];
            tCtx.beginPath();
            tCtx.moveTo(a.x * CONFIG.cellSize + CONFIG.cellSize/2, a.y * CONFIG.cellSize + CONFIG.cellSize/2);
            tCtx.lineTo(b.x * CONFIG.cellSize + CONFIG.cellSize/2, b.y * CONFIG.cellSize + CONFIG.cellSize/2);
            tCtx.stroke();
        }
        tCtx.setLineDash([]);
    }
}

// --- DIBUJAR JUGADOR ---
function drawPlayer(highlightCells = []) {
    drawGrid(pCtx, highlightCells);
    
    if (state.mode === 'grid') {
        const colors = state.mode === 'grid' ? CONFIG.colors.grid : CONFIG.colors.connect;
        
        state.playerShape.forEach((p, i) => {
            const isLast = i === state.playerShape.length - 1;
            drawRoundedCell(pCtx, p.x, p.y, colors.fill, colors.stroke, isLast);
        });
    } else if (state.mode === 'connect') {
        // Dibujar líneas conectadas
        if (state.playerShape.length > 1) {
            const colors = CONFIG.colors.connect;
            pCtx.strokeStyle = colors.fill;
            pCtx.lineWidth = 3;
            pCtx.lineCap = 'round';
            pCtx.lineJoin = 'round';
            
            pCtx.beginPath();
            pCtx.moveTo(
                state.playerShape[0].x * CONFIG.cellSize + CONFIG.cellSize/2,
                state.playerShape[0].y * CONFIG.cellSize + CONFIG.cellSize/2
            );
            
            for (let i = 1; i < state.playerShape.length; i++) {
                pCtx.lineTo(
                    state.playerShape[i].x * CONFIG.cellSize + CONFIG.cellSize/2,
                    state.playerShape[i].y * CONFIG.cellSize + CONFIG.cellSize/2
                );
            }
            pCtx.stroke();
        }
        
        // Dibujar puntos
        state.playerShape.forEach((p, i) => {
            const cx = p.x * CONFIG.cellSize + CONFIG.cellSize / 2;
            const cy = p.y * CONFIG.cellSize + CONFIG.cellSize / 2;
            
            pCtx.beginPath();
            pCtx.arc(cx, cy, 7, 0, Math.PI * 2);
            pCtx.fillStyle = CONFIG.colors.connect.fill;
            pCtx.fill();
            pCtx.strokeStyle = 'white';
            pCtx.lineWidth = 2;
            pCtx.stroke();
            
            // Número
            pCtx.fillStyle = 'white';
            pCtx.font = 'bold 10px Nunito';
            pCtx.textAlign = 'center';
            pCtx.textBaseline = 'middle';
            pCtx.fillText(i + 1, cx, cy);
        });
    }
}

// --- DIBUJAR CELDA REDONDEADA ---
function drawRoundedCell(ctx, x, y, fill, stroke, glow = false) {
    const cs = CONFIG.cellSize;
    const pad = 3;
    const r = 6;
    
    const px = x * cs + pad;
    const py = y * cs + pad;
    const pw = cs - pad * 2;
    const ph = cs - pad * 2;
    
    // Glow
    if (glow) {
        ctx.shadowColor = CONFIG.colors.grid.glow;
        ctx.shadowBlur = 15;
    }
    
    ctx.beginPath();
    ctx.roundRect(px, py, pw, ph, r);
    ctx.fillStyle = fill;
    ctx.fill();
    
    ctx.shadowBlur = 0;
    
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 2;
    ctx.stroke();
}

// --- CUENTA REGRESIVA ---
function startCountdown() {
    let count = CONFIG.countdownTime;
    els.countdownOverlay.classList.add('active');
    
    const interval = setInterval(() => {
        els.countdownNumber.textContent = count;
        els.countdownNumber.style.animation = 'none';
        els.countdownNumber.offsetHeight; // trigger reflow
        els.countdownNumber.style.animation = '';
        
        count--;
        
        if (count < 0) {
            clearInterval(interval);
            els.countdownOverlay.classList.remove('active');
            state.isMemorizing = false;
            state.startTime = Date.now();
            startTimer();
            
            // Ocultar objetivo en modo grid para memorización
            if (state.mode === 'grid') {
                drawGrid(tCtx);
                showToast('🧠 ¡Memoriza y reproduce!', 'success');
            }
        }
    }, 800);
}

// --- TIMER ---
function startTimer() {
    clearInterval(state.timerInterval);
    state.timerInterval = setInterval(() => {
        state.elapsedTime = Math.floor((Date.now() - state.startTime) / 1000);
        els.timerDisplay.textContent = `⏱️ ${state.elapsedTime}s`;
    }, 1000);
}

function stopTimer() {
    clearInterval(state.timerInterval);
}

// --- INPUT ---
function handleInput(clientX, clientY) {
    if (state.isMemorizing) {
        showToast('⏳ Espera a que termine la cuenta...', 'error');
        return;
    }
    
    const rect = els.playerCanvas.getBoundingClientRect();
    const scaleX = els.playerCanvas.width / rect.width;
    const scaleY = els.playerCanvas.height / rect.height;
    
    const x = Math.floor(((clientX - rect.left) * scaleX) / CONFIG.cellSize);
    const y = Math.floor(((clientY - rect.top) * scaleY) / CONFIG.cellSize);
    
    if (x < 0 || x >= CONFIG.size || y < 0 || y >= CONFIG.size) return;
    
    if (state.mode === 'grid') {
        togglePoint(x, y);
    } else {
        handleConnect(x, y);
    }
    
    drawPlayer();
}

function togglePoint(x, y) {
    const i = state.playerShape.findIndex(p => p.x === x && p.y === y);
    if (i >= 0) {
        state.playerShape.splice(i, 1);
        playSound('pop');
    } else {
        state.playerShape.push({ x, y });
        playSound('tick');
    }
}

function handleConnect(x, y) {
    const expected = state.targetShape[state.currentIndex];
    
    if (!expected) return;
    
    if (expected.x === x && expected.y === y) {
        state.playerShape.push({ x, y });
        state.currentIndex++;
        playSound('tick');
        
        if (state.currentIndex === state.targetShape.length) {
            stopTimer();
            levelComplete();
        }
    } else {
        // Verificar si ya fue tocado
        const alreadyTouched = state.playerShape.some(p => p.x === x && p.y === y);
        if (!alreadyTouched) {
            showToast('❌ ¡Sigue el orden correcto!', 'error');
            playSound('error');
            
            // Animación de shake en el canvas
            els.playerCanvas.classList.add('shake');
            setTimeout(() => els.playerCanvas.classList.remove('shake'), 500);
        }
    }
}

// --- VALIDACIÓN ---
function checkSolution() {
    if (state.mode !== 'grid') return;
    
    if (state.playerShape.length === 0) {
        showToast('🤔 Toca algunas casillas primero', 'error');
        return;
    }
    
    const correct = state.targetShape.length === state.playerShape.length &&
        state.targetShape.every(t =>
            state.playerShape.some(p => p.x === t.x && p.y === t.y)
        );
    
    if (correct) {
        stopTimer();
        levelComplete();
    } else {
        showToast('❌ ¡No coincide! Intenta de nuevo', 'error');
        playSound('error');
        
        els.playerCanvas.classList.add('shake');
        setTimeout(() => els.playerCanvas.classList.remove('shake'), 500);
    }
}

// --- NIVEL COMPLETADO ---
function levelComplete() {
    stopTimer();
    
    // Calcular estrellas
    const time = state.elapsedTime;
    const baseTime = state.targetShape.length * 2;
    let stars = 1;
    if (time <= baseTime) stars = 3;
    else if (time <= baseTime * 2) stars = 2;
    
    state.stars = stars;
    state.totalStars += stars;
    
    // Calcular monedas
    const coinReward = CONFIG.baseCoins + (state.level * 2) + (stars * 5);
    state.coins += coinReward;
    
    saveGame();
    updateUI();
    
    // Mostrar pantalla de victoria
    showWinScreen(stars, coinReward);
    
    // Efectos
    playSound('win');
    fireConfetti();
}

function showWinScreen(stars, coins) {
    els.winStars.textContent = '⭐'.repeat(stars) + '☆'.repeat(3 - stars);
    els.winCoins.textContent = coins;
    els.winTime.textContent = state.elapsedTime + 's';
    
    if (stars === 3) {
        els.winTitle.textContent = '🏆 ¡PERFECTO!';
        els.winTitle.style.color = '#f59e0b';
    } else if (stars === 2) {
        els.winTitle.textContent = '✨ ¡MUY BIEN!';
        els.winTitle.style.color = '#6366f1';
    } else {
        els.winTitle.textContent = '👍 ¡BIEN HECHO!';
        els.winTitle.style.color = '#10b981';
    }
    
    showScreen('win');
}

// --- PISTA ---
function useHint() {
    if (state.coins < CONFIG.hintCost) {
        showToast(`💰 Necesitas ${CONFIG.hintCost} monedas`, 'error');
        return;
    }
    
    if (state.mode === 'grid') {
        // Mostrar una celda faltante
        const missing = state.targetShape.find(t => 
            !state.playerShape.some(p => p.x === t.x && p.y === t.y)
        );
        
        if (missing) {
            state.coins -= CONFIG.hintCost;
            saveGame();
            updateUI();
            drawPlayer([missing]);
            showToast('💡 ¡Mira la casilla dorada!', 'success');
            playSound('hint');
        } else {
            showToast('✅ ¡Ya está completo!', 'success');
        }
    } else {
        // Modo connect: mostrar siguiente punto
        const next = state.targetShape[state.currentIndex];
        if (next) {
            state.coins -= CONFIG.hintCost;
            saveGame();
            updateUI();
            drawPlayer([next]);
            showToast(`💡 ¡Toca el punto ${state.currentIndex + 1}!`, 'success');
            playSound('hint');
        }
    }
}

// --- LIMPIAR ---
function clearBoard() {
    state.playerShape = [];
    state.currentIndex = 0;
    drawPlayer();
    playSound('pop');
    showToast('🗑️ Tablero limpio', 'success');
}

// --- UI ---
function updateUI() {
    els.levelDisplay.textContent = `Nivel ${state.level}`;
    els.coinsDisplay.textContent = state.coins;
    els.starsDisplay.textContent = state.totalStars;
    
    // Actualizar botón de pista
    els.btnHint.disabled = state.coins < CONFIG.hintCost;
}

// --- TOAST ---
let toastTimeout;
function showToast(message, type = '') {
    clearTimeout(toastTimeout);
    
    els.toast.textContent = message;
    els.toast.className = 'toast show ' + type;
    
    toastTimeout = setTimeout(() => {
        els.toast.classList.remove('show');
    }, 2500);
}

// --- SONIDOS (simulados visualmente) ---
function playSound(type) {
    // En una app real usarías Audio(), aquí usamos feedback visual
    const vibrations = {
        tick: 10,
        pop: 15,
        error: 50,
        win: 30,
        hint: 20
    };
    
    if (navigator.vibrate && vibrations[type]) {
        navigator.vibrate(vibrations[type]);
    }
}

// --- CONFETTI ---
function fireConfetti() {
    const particles = [];
    const colors = ['#f43f5e', '#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#ec4899'];
    
    for (let i = 0; i < 100; i++) {
        particles.push({
            x: window.innerWidth / 2,
            y: window.innerHeight / 2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15 - 5,
            color: colors[Math.floor(Math.random() * colors.length)],
            size: Math.random() * 8 + 4,
            life: 1,
            decay: Math.random() * 0.02 + 0.01
        });
    }
    
    function animate() {
        cCtx.clearRect(0, 0, els.confettiCanvas.width, els.confettiCanvas.height);
        
        let alive = false;
        particles.forEach(p => {
            if (p.life > 0) {
                alive = true;
                p.x += p.vx;
                p.y += p.vy;
                p.vy += 0.3; // gravedad
                p.life -= p.decay;
                
                cCtx.globalAlpha = p.life;
                cCtx.fillStyle = p.color;
                cCtx.beginPath();
                cCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                cCtx.fill();
            }
        });
        
        cCtx.globalAlpha = 1;
        
        if (alive) {
            requestAnimationFrame(animate);
        }
    }
    
    animate();
}

// --- UTILIDADES ---
function rand() {
    return Math.floor(Math.random() * CONFIG.size);
}

function clamp(v) {
    return Math.max(0, Math.min(CONFIG.size - 1, v));
}

// --- EVENT LISTENERS ---
els.btnPlay.addEventListener('click', () => {
    showScreen('game');
    initGame();
    playSound('tick');
});

els.btnHowTo.addEventListener('click', () => {
    showScreen('tutorial');
    playSound('tick');
});

els.btnBackFromTutorial.addEventListener('click', () => {
    showScreen('start');
    playSound('pop');
});

els.btnVerify.addEventListener('click', () => {
    checkSolution();
});

els.btnClear.addEventListener('click', () => {
    clearBoard();
});

els.btnHint.addEventListener('click', () => {
    useHint();
});

els.btnMenu.addEventListener('click', () => {
    showScreen('start');
    saveGame();
    playSound('pop');
});

els.btnNextLevel.addEventListener('click', () => {
    state.level++;
    saveGame();
    showScreen('game');
    generateLevel();
    updateUI();
    playSound('tick');
});

// Canvas events
els.playerCanvas.addEventListener('click', (e) => {
    handleInput(e.clientX, e.clientY);
});

els.playerCanvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    handleInput(e.touches[0].clientX, e.touches[0].clientY);
}, { passive: false });

// Prevenir zoom en móvil
document.addEventListener('touchmove', (e) => {
    if (e.scale !== 1) {
        e.preventDefault();
    }
}, { passive: false });

// --- INICIALIZACIÓN ---
function initGame() {
    loadGame();
    initCanvas();
    generateLevel();
    updateUI();
}

// Iniciar en pantalla de inicio
showScreen('start');
