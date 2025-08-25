const COOKIE_NAME_SID = "sid";
const COOKIE_NAME_SFP = "sfp";
const COOKIE_PATH = "/";               // ajuste se quiser escopo menor
const COOKIE_SAMESITE = "Lax";         // "Strict" se sua navegação permitir
const REQUIRE_SECURE = true;           // force "Secure" em produção HTTPS

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