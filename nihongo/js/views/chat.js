// AI Conversation — an offline, rule-based Japanese tutor.
// Recognizes common intents and replies with Japanese + romaji + meaning + a
// short grammar note. Works fully client-side (no API key needed).
import { State, save, speak, addXp, touchActivity, el, esc } from '../core.js';

// Each rule: match (regex on lowercased english/romaji), and a reply object.
const RULES = [
  { m: /good morning|ohayo/, jp: 'おはようございます。', r: 'Ohayō gozaimasu.', mean: 'Good morning.',
    note: 'The polite morning greeting. Drop ございます with close friends.' },
  { m: /good night|oyasumi/, jp: 'おやすみなさい。', r: 'Oyasuminasai.', mean: 'Good night.',
    note: 'Said before going to bed.' },
  { m: /good (afternoon|evening)|hello|hi|konnichiwa|konbanwa/, jp: 'こんにちは！お元気ですか？', r: 'Konnichiwa! O-genki desu ka?', mean: 'Hello! How are you?',
    note: 'こんにちは works for hello/afternoon. か at the end makes a question.' },
  { m: /how are you|genki/, jp: '元気です、ありがとう。あなたは？', r: 'Genki desu, arigatō. Anata wa?', mean: "I'm well, thanks. And you?",
    note: '元気です = "I am well". あなたは？ turns it back to the listener.' },
  { m: /thank you|thanks|arigato/, jp: 'どういたしまして。', r: 'Dō itashimashite.', mean: "You're welcome.",
    note: 'The standard response to ありがとう.' },
  { m: /sorry|excuse me|sumimasen/, jp: '大丈夫ですよ。', r: 'Daijōbu desu yo.', mean: "It's okay.",
    note: 'よ adds gentle emphasis, reassuring the listener.' },
  { m: /my name is|i am|i'm|namae|watashi wa/, jp: 'はじめまして、よろしくお願いします。', r: 'Hajimemashite, yoroshiku onegai shimasu.', mean: 'Nice to meet you.',
    note: 'A set phrase exchanged when meeting someone for the first time.' },
  { m: /goodbye|bye|sayonara|see you/, jp: 'さようなら！また会いましょう。', r: 'Sayōnara! Mata aimashō.', mean: "Goodbye! Let's meet again.",
    note: 'またね is a more casual "see you".' },
  { m: /i love you|suki|daisuki/, jp: '私もあなたが好きです。', r: 'Watashi mo anata ga suki desu.', mean: 'I like you too.',
    note: 'が marks the object of emotion with 好き (to like).' },
  { m: /hungry|onaka|eat|tabe/, jp: 'お腹が空きました。何か食べましょう。', r: 'Onaka ga sukimashita. Nanika tabemashō.', mean: "I'm hungry. Let's eat something.",
    note: 'ましょう = "let us ~", a friendly suggestion.' },
  { m: /where|doko|station|eki/, jp: 'すみません、道に迷いました。', r: 'Sumimasen, michi ni mayoimashita.', mean: "Excuse me, I'm lost.",
    note: 'Useful when asking for directions.' },
  { m: /weather|tenki|hot|cold|atsui|samui/, jp: '今日はいい天気ですね。', r: 'Kyō wa ii tenki desu ne.', mean: "It's nice weather today, isn't it?",
    note: 'ね invites agreement, like "isn\'t it?".' },
  { m: /what.*\?|nani|nan desu/, jp: 'いい質問ですね！', r: 'Ii shitsumon desu ne!', mean: "That's a good question!",
    note: '質問 (shitsumon) means "question".' },
];

const FALLBACKS = [
  { jp: 'なるほど、そうですか。', r: 'Naruhodo, sō desu ka.', mean: 'I see, is that so.',
    note: 'なるほど shows you understand. Keep the conversation going!' },
  { jp: 'もう少し話してください。', r: 'Mō sukoshi hanashite kudasai.', mean: 'Please tell me a little more.',
    note: '〜てください is a polite request form.' },
  { jp: 'いいですね！日本語が上手ですよ。', r: 'Ii desu ne! Nihongo ga jōzu desu yo.', mean: 'Nice! Your Japanese is good.',
    note: '上手 (jōzu) means "skilled / good at".' },
];

const SUGGESTIONS = ['Good morning', 'How are you?', 'Thank you', 'My name is Alex', 'Where is the station?', 'Goodbye'];

let history = [];

export function render(root) {
  if (!history.length) {
    history = [{ who: 'ai', jp: 'こんにちは！日本語で話しましょう。', r: 'Konnichiwa! Nihongo de hanashimashō.',
      mean: "Hello! Let's talk in Japanese.", note: 'Type in English or rōmaji — I\'ll reply in Japanese.' }];
  }
  root.innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">Practice · AI Conversation</div>
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">AI Conversation</h1>
      <p class="muted" style="margin-bottom:18px;">A patient tutor that always answers in Japanese, with romaji, meaning, and a grammar tip. Tap any reply to hear it.</p>

      <div class="card card-pad">
        <div class="chat-scroll" id="scroll"></div>
        <div class="composer">
          <input id="input" placeholder="Say something in English or rōmaji…" autocomplete="off" />
          <button class="btn accent" id="send">Send</button>
        </div>
        <div class="row wrap" id="suggest" style="gap:6px;margin-top:12px;"></div>
      </div>
    </div>`;

  const scroll = root.querySelector('#scroll');
  history.forEach(h => scroll.appendChild(bubble(h)));
  scroll.scrollTop = scroll.scrollHeight;

  const input = root.querySelector('#input');
  const send = () => {
    const text = input.value.trim();
    if (!text) return;
    input.value = '';
    push(scroll, { who: 'user', jp: text });
    const reply = respond(text);
    setTimeout(() => {
      push(scroll, { who: 'ai', ...reply });
      speak(reply.jp);
      addXp(3); save(); touchActivity();
    }, 380);
  };
  root.querySelector('#send').onclick = send;
  input.onkeydown = (e) => { if (e.key === 'Enter') send(); };

  const sg = root.querySelector('#suggest');
  SUGGESTIONS.forEach(s => {
    const chip = el(`<button class="chip">${esc(s)}</button>`);
    chip.onclick = () => { input.value = s; send(); };
    sg.appendChild(chip);
  });
  input.focus();
}

function respond(text) {
  const t = text.toLowerCase();
  for (const rule of RULES) if (rule.m.test(t)) return rule;
  return FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
}

function push(scroll, h) {
  history.push(h);
  scroll.appendChild(bubble(h));
  scroll.scrollTop = scroll.scrollHeight;
}

function bubble(h) {
  if (h.who === 'user') {
    return el(`<div class="bubble user">${esc(h.jp)}</div>`);
  }
  const b = el(`
    <div class="bubble ai">
      <div class="jp" style="font-size:17px;">${esc(h.jp)}</div>
      <div class="romaji-line">${esc(h.r || '')}${h.mean ? ' — ' + esc(h.mean) : ''}</div>
      ${h.note ? `<div class="explain">💡 ${esc(h.note)}</div>` : ''}
    </div>`);
  b.style.cursor = 'pointer';
  b.onclick = () => speak(h.jp);
  return b;
}
