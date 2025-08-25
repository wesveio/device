const COOKIE_NAME_SID = "sid";
const COOKIE_NAME_SFP = "sfp";
const COOKIE_PATH = "/";               // ajuste se quiser escopo menor
const COOKIE_SAMESITE = "Lax";         // "Strict" se sua navegação permitir
const REQUIRE_SECURE = true;           // force "Secure" em produção HTTPS

// Capturar o tempo de início do carregamento
const PAGE_LOAD_START_TIME = performance.now();

function getCookie(name) {
    const m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([$()*+./?[\\\]^{|}-])/g, "\\$1") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : null;
}

function setSessionCookie(name, value, { path = COOKIE_PATH, sameSite = COOKIE_SAMESITE, secure = REQUIRE_SECURE } = {}) {
    let cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Path=${path}; SameSite=${sameSite}`;
    if (secure && location.protocol === "https:") cookie += "; Secure";
    // sem Expires/Max-Age => cookie de sessão
    document.cookie = cookie;
}

function randomSessionId(bytes = 16) {
    const arr = new Uint8Array(bytes);
    crypto.getRandomValues(arr);
    // base64url
    return btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(input) {
    const enc = new TextEncoder().encode(input);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join("");
}

// Sinais leves (evite fingerprint agressivo tipo canvas/webgl se não precisar)
function collectSignals() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const dnt = navigator.doNotTrack || navigator.msDoNotTrack || window.doNotTrack || "";
    const touch = (navigator.maxTouchPoints || 0).toString();
    const lang = navigator.language || "";
    const langs = (navigator.languages || []).join(",");
    const ua = navigator.userAgent || ""; // pode ser igual entre Arc/Chrome
    const platform = navigator.platform || "";
    const vendor = navigator.vendor || "";
    const hw = (navigator.hardwareConcurrency || 0).toString();
    const mem = (navigator.deviceMemory || 0).toString();
    const scr = window.screen || {};
    const scrSig = [scr.width, scr.height, scr.availWidth, scr.availHeight, scr.colorDepth, scr.pixelDepth].join("x");
    return [tz, dnt, touch, lang, langs, ua, platform, vendor, hw, mem, scrSig].join("|");
}

// Função para coletar informações de rede e conectividade
async function collectNetworkInfo() {
    const networkInfo = {
        online: navigator.onLine,
        connectionType: 'unknown',
        effectiveType: 'unknown',
        downlink: 0,
        rtt: 0,
        saveData: false
    };

    // Verificar se a API Network Information está disponível
    if ('connection' in navigator) {
        const connection = navigator.connection;
        networkInfo.connectionType = connection.effectiveType || connection.type || 'unknown';
        networkInfo.downlink = connection.downlink || 0;
        networkInfo.rtt = connection.rtt || 0;
        networkInfo.saveData = connection.saveData || false;
    }

    // Teste simples de latência
    const startTime = performance.now();
    try {
        await fetch('/favicon.ico', { method: 'HEAD', cache: 'no-cache' });
        networkInfo.latency = Math.round(performance.now() - startTime);
    } catch (error) {
        networkInfo.latency = 'N/A';
    }

    return networkInfo;
}

// Função para coletar informações de performance
function collectPerformanceInfo() {
    const perfInfo = {
        loadTime: 'Not available',
        domContentLoaded: 'Not available',
        firstPaint: 'Not available',
        firstContentfulPaint: 'Not available',
        memoryUsage: null,
        fps: 'N/A'
    };

    // Calcular tempo de carregamento baseado no tempo de início capturado
    const currentTime = performance.now();
    const estimatedLoadTime = Math.round(currentTime - PAGE_LOAD_START_TIME);

    if (estimatedLoadTime > 0 && estimatedLoadTime < 60000) { // Máximo 60 segundos
        perfInfo.loadTime = estimatedLoadTime;
    }

    // Usar apenas a API moderna para tempos de carregamento
    if (performance.getEntriesByType) {
        const navigationEntry = performance.getEntriesByType('navigation')[0];
        if (navigationEntry) {
            // Verificar se os valores são válidos (positivos e razoáveis)
            const domReady = Math.round(navigationEntry.domContentLoadedEventEnd - navigationEntry.startTime);

            if (domReady > 0 && domReady < 60000) { // Máximo 60 segundos
                perfInfo.domContentLoaded = domReady;
            }
        }
    }

    // Paint timing
    if (performance.getEntriesByType) {
        const paintEntries = performance.getEntriesByType('paint');
        paintEntries.forEach(entry => {
            if (entry.name === 'first-paint' && entry.startTime > 0) {
                perfInfo.firstPaint = Math.round(entry.startTime);
            }
            if (entry.name === 'first-contentful-paint' && entry.startTime > 0) {
                perfInfo.firstContentfulPaint = Math.round(entry.startTime);
            }
        });
    }

    // Uso de memória (se disponível)
    if (performance.memory) {
        perfInfo.memoryUsage = {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
        };
    }

    return perfInfo;
}

// Função para medir FPS
function startFPSMeasurement() {
    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 0;

    function measureFPS() {
        frameCount++;
        const currentTime = performance.now();

        if (currentTime - lastTime >= 1000) {
            fps = Math.round((frameCount * 1000) / (currentTime - lastTime));
            frameCount = 0;
            lastTime = currentTime;
        }

        requestAnimationFrame(measureFPS);
    }

    requestAnimationFrame(measureFPS);

    // Retorna uma função para obter o FPS atual
    return () => fps;
}

/**
 * Cria/recupera o SID de sessão e um fingerprint "sfp" derivado de SID + sinais.
 * - Retorna { sid, sfp }
 * - Ambos são cookies de sessão (somem ao fechar o navegador)
 */
async function getSessionFingerprint() {
    let sid = getCookie(COOKIE_NAME_SID);
    if (!sid) {
        sid = randomSessionId(); // único por sessão do browser
        setSessionCookie(COOKIE_NAME_SID, sid, {});
    }

    let sfp = getCookie(COOKIE_NAME_SFP);
    let signals = collectSignals();
    if (!sfp) {
        sfp = await sha256Hex(`${sid}::${signals}`);
        setSessionCookie(COOKIE_NAME_SFP, sfp, {});
    }

    return { sid, sfp, signals };
}

// Exemplo de uso:
(async () => {
    const { sid, sfp, signals } = await getSessionFingerprint();
    console.log("Session ID:", sid);
    console.log("Session Fingerprint:", sfp);
    console.log("Signals:", signals);
})();