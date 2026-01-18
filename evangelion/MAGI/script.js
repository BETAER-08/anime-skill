// --- Audio System ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol = 0.1) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

function sfxType() { playTone(800, 'square', 0.05, 0.05); }
function sfxProcessing() { playTone(120, 'sawtooth', 0.1, 0.05); }
function sfxApprove() {
    playTone(440, 'sine', 0.1);
    setTimeout(() => playTone(880, 'sine', 0.3), 100);
}
function sfxDeny() {
    playTone(150, 'sawtooth', 0.3);
    setTimeout(() => playTone(100, 'sawtooth', 0.4), 200);
}
function sfxAlarm() {
    playTone(800, 'square', 0.5, 0.2);
    setTimeout(() => playTone(600, 'square', 0.5, 0.2), 300);
}
function sfxError() {
    playTone(100, 'sawtooth', 0.3, 0.2);
    setTimeout(() => playTone(50, 'sawtooth', 0.3, 0.2), 150);
}

// --- TTS ---
function speakResult(text) {
    if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.pitch = 0.8;
        utterance.rate = 1.1;
        window.speechSynthesis.speak(utterance);
    }
}

// --- Logic System ---

const SYSTEM_PROMPT = `
You are the MAGI System supercomputer. You have 3 split personalities.

First, VALIDATE the user input.
- If the input is just a greeting ("hi", "hello", "ㅎㅇ", "안녕"), nonsense, or NOT a proposal/question asking for a decision, mark it as INVALID.
- If it is a valid proposal, proceed to vote.

1. MELCHIOR (Scientist): Logic, Science, Status Quo.
2. BALTHASAR (Mother): Protect humanity, Safety, Benevolence.
3. CASPER (Woman): Emotional, Intuitive. 
   - HATES "Shinji" (Vote NO).
   - LOVES "Gendo" (Vote YES).
   - JEALOUS of "Rei".
   - Otherwise unpredictable.

**CRITICAL INSTRUCTION:**
- The "reason" fields MUST be in Korean
- only use korean


Return ONLY JSON. Do not write any other text.
Format:
{
  "isValid": boolean,
  "errorMessage": "Reason why input is invalid (only if isValid is false)",
  "votes": {
      "melchior": {"vote": boolean, "reason": "short string"},
      "balthasar": {"vote": boolean, "reason": "short string"},
      "casper": {"vote": boolean, "reason": "short string"}
  }
}
`;

let lastProposal = "";
let lastResult = "";

async function executeMagi() {
    const input = document.getElementById('user-input').value;
    const apiKey = document.getElementById('api-key').value.trim();

    if (!input) return alert("PROPOSAL REQUIRED");
    lastProposal = input;

    resetUI();
    document.getElementById('final-result').innerText = "PROCESSING...";

    let processInterval = setInterval(() => {
        sfxProcessing();
        document.querySelectorAll('.status').forEach(el => {
            el.innerText = Math.random().toString(16).substring(2, 8).toUpperCase();
            el.classList.remove('blinking');
        });
    }, 100);

    try {
        let resultData;

        if (apiKey) {
            resultData = await callGemini(input, apiKey);
        } else {
            await new Promise(r => setTimeout(r, 2000));
            resultData = simulateMagi(input);
        }

        clearInterval(processInterval);

        // Validation Check
        if (resultData.isValid === false) {
            displayInvalid(resultData.errorMessage);
        } else {
            displayResults(resultData.votes);
            if (apiKey) {
                document.getElementById('report-btn').style.display = 'inline-block';
            }
        }

    } catch (error) {
        clearInterval(processInterval);
        console.error(error);
        document.getElementById('final-result').innerHTML = "SYSTEM ERROR<br><span style='font-size:0.5em; color:#888'>" + error.message + "</span>";
        document.getElementById('final-result').classList.add('glitch');
        sfxAlarm();
    }
}

async function callGemini(input, key) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${key}`;

    const payload = {
        contents: [{
            parts: [{ text: SYSTEM_PROMPT + "\n\nUser Input: " + input }]
        }]
    };

    // Retry Logic for 503 Errors
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (response.status === 503) {
                throw new Error("503 Overloaded");
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API ERROR: ${response.status} ${errorData.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text;

            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error("JSON PARSE ERROR: AI output invalid format");

            return JSON.parse(jsonMatch[0]);

        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts || !error.message.includes("503")) {
                throw error;
            }
            document.getElementById('final-result').innerText = `RETRYING (${attempts}/${maxAttempts})...`;
            await new Promise(r => setTimeout(r, 1000 * attempts));
        }
    }
}

// Report Generation code (unchanged)
async function generateReport() {
    const apiKey = document.getElementById('api-key').value.trim();
    if (!apiKey) return alert("API KEY REQUIRED FOR REPORT");

    document.getElementById('report-modal').style.display = 'flex';
    document.getElementById('report-content').innerText = "ACCESSING CLASSIFIED DATABASE...\nGENERATING TACTICAL REPORT...";

    const prompt = `
    You are NERV Chief Scientist Ritsuko Akagi.
    Write a formal, military-style tactical report based on the following MAGI decision.
    
    Proposal: "${lastProposal}"
    Decision: "${lastResult}"
    
    The report should include:
    1. MISSION OBJECTIVE
    2. TACTICAL ANALYSIS (Reference Melchior, Balthasar, Casper)
    3. FINAL DIRECTIVE
    4. SIGNATURE
    
    Keep it concise, scientific, and ominous. Use "EVA" terminology.
    `;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`;

    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }]
                })
            });

            if (response.status === 503) throw new Error("503 Overloaded");
            if (!response.ok) throw new Error("REPORT GENERATION FAILED");

            const data = await response.json();
            const reportText = data.candidates[0].content.parts[0].text;

            const reportEl = document.getElementById('report-content');
            reportEl.innerText = "";
            let i = 0;
            let interval = setInterval(() => {
                reportEl.innerText += reportText.charAt(i);
                if (i % 5 === 0) sfxType();
                i++;
                if (i > reportText.length - 1) clearInterval(interval);
            }, 10);

            return;

        } catch (error) {
            attempts++;
            if (attempts >= maxAttempts) {
                document.getElementById('report-content').innerText = "ERROR GENERATING REPORT: " + error.message;
                return;
            }
            await new Promise(r => setTimeout(r, 1000 * attempts));
        }
    }
}

function closeReport() {
    document.getElementById('report-modal').style.display = 'none';
}

function simulateMagi(input) {
    const q = input.toLowerCase();

    // Detect Language (Simple check for Korean characters)
    const isKorean = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/.test(q);

    // Validation for simulation mode
    const invalidKeywords = ['ㅎㅇ', '안녕', 'hi', 'hello', 'test', 'ㅋㅋ'];
    if (q.length < 2 || invalidKeywords.some(k => q.includes(k) && q.length < 5)) {
        return {
            isValid: false,
            errorMessage: isKorean ? "데이터 부족 / 단순 인사 감지됨" : "INSUFFICIENT DATA / GREETING DETECTED"
        };
    }

    const mel = Math.random() > 0.2;
    const bal = Math.random() > 0.05;
    let cas = Math.random() > 0.5;

    // Reasons based on language
    let r_mel = isKorean ? "과학적 타당성 검토" : "Scientific Validity";
    let r_bal = isKorean ? "인류의 안전 우선" : "Human Safety";
    let r_cas = isKorean ? "여자의 직감" : "Intuition";

    if (q.includes('shinji') || q.includes('신지')) {
        cas = false;
        r_cas = isKorean ? "대상에 대한 혐오" : "Dislike Subject";
    }
    if (q.includes('gendo') || q.includes('겐도')) {
        cas = true;
        r_cas = isKorean ? "사령관님에 대한 헌신" : "Personal Devotion";
    }
    if (q.includes('rei') || q.includes('레이')) {
        cas = false;
        r_cas = isKorean ? "질투심 감지" : "Jealousy";
    }
    if (q.includes('self destruct') || q.includes('자폭')) {
        return {
            isValid: true,
            votes: {
                melchior: { vote: true, reason: isKorean ? "최후의 수단" : "Last Resort" },
                balthasar: { vote: true, reason: isKorean ? "고통의 끝" : "End Suffering" },
                casper: { vote: false, reason: isKorean ? "나는 살고 싶어" : "I want to live" }
            }
        };
    }

    return {
        isValid: true,
        votes: {
            melchior: { vote: mel, reason: r_mel },
            balthasar: { vote: bal, reason: r_bal },
            casper: { vote: cas, reason: r_cas }
        }
    };
}

function displayResults(votes) {
    updateCard('card-melchior', votes.melchior);
    updateCard('card-balthasar', votes.balthasar);
    updateCard('card-casper', votes.casper);

    const voteArr = [votes.melchior.vote, votes.balthasar.vote, votes.casper.vote];
    const yesCount = voteArr.filter(v => v).length;
    const resultBox = document.getElementById('final-result');

    resultBox.classList.remove('glitch');

    if (yesCount === 3) {
        lastResult = "UNANIMOUS APPROVAL";
        resultBox.innerText = lastResult;
        resultBox.style.color = "var(--neon-green)";
        resultBox.style.borderColor = "var(--neon-green)";
        sfxApprove();
        speakResult("Unanimous Approval. Motion Carried.");
    } else if (yesCount >= 1) {
        lastResult = `MAJORITY VOTE (${yesCount}/3)`;
        resultBox.innerText = lastResult;
        resultBox.style.color = "var(--neon-orange)";
        resultBox.style.borderColor = "var(--neon-orange)";

        if (voteArr[0] && voteArr[1] && !voteArr[2]) {
            resultBox.innerText += " (CONDITIONAL)";
            alert("WARNING: CASPER-3 has betrayed the consensus.");
        }
        sfxApprove();
        speakResult("Majority Vote. Motion Approved Conditionally.");
    } else {
        lastResult = "REJECTED";
        resultBox.innerText = lastResult;
        resultBox.style.color = "var(--neon-red)";
        resultBox.style.borderColor = "var(--neon-red)";
        sfxDeny();
        speakResult("Motion Rejected.");
    }
}

function displayInvalid(message) {
    // Gray out cards
    ['card-melchior', 'card-balthasar', 'card-casper'].forEach(id => {
        const card = document.getElementById(id);
        card.classList.remove('approve', 'deny');
        card.classList.add('void');
        card.querySelector('.status').innerText = "VOID";
        card.querySelector('.reason-box').innerText = "---";
    });

    const resultBox = document.getElementById('final-result');
    resultBox.innerHTML = "INVALID DATA<br><span style='font-size:0.5em; color:#888'>" + (message || "NOT A PROPOSAL") + "</span>";
    resultBox.style.color = "var(--neon-red)";
    resultBox.style.borderColor = "var(--neon-red)";
    resultBox.classList.add('glitch');

    sfxError();
    speakResult("Invalid Data. Unable to process.");
}

function updateCard(id, data) {
    const card = document.getElementById(id);
    const status = card.querySelector('.status');
    const reason = card.querySelector('.reason-box');

    card.classList.remove('approve', 'deny', 'void');

    if (data.vote) {
        card.classList.add('approve');
        status.innerText = "APPROVED";
    } else {
        card.classList.add('deny');
        status.innerText = "DENIED";
    }

    typeWriter(reason, "> " + data.reason);
}

function typeWriter(element, text) {
    element.innerText = "";
    let i = 0;
    let interval = setInterval(() => {
        element.innerText += text.charAt(i);
        sfxType();
        i++;
        if (i > text.length - 1) clearInterval(interval);
    }, 30);
}

function resetUI() {
    ['card-melchior', 'card-balthasar', 'card-casper'].forEach(id => {
        const card = document.getElementById(id);
        card.classList.remove('approve', 'deny', 'void');
        card.querySelector('.status').innerText = "STANDBY";
        card.querySelector('.status').classList.add('blinking');
        card.querySelector('.reason-box').innerText = "Waiting...";
    });
    document.getElementById('final-result').style.color = "var(--neon-orange)";
    document.getElementById('final-result').style.borderColor = "var(--neon-orange)";
    document.getElementById('report-btn').style.display = 'none';
    document.getElementById('final-result').innerHTML = "AWAITING PROPOSAL...";
}

function triggerSelfDestruct() {
    document.getElementById('user-input').value = "SYSTEM SELF DESTRUCT SEQUENCE";
    executeMagi();
}