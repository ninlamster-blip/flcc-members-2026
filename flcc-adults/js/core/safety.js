// Safety runs on the device, before anything is sent anywhere.
//
// When a question suggests self-harm, abuse or danger, ASK does not answer it.
// It replaces the answer with a card that names the people who can actually
// help. No model is called at all — the path does not depend on a model
// behaving well, on a network, or on a proxy being reachable.
//
// This is the adult edition of the kids app's screen, and it is deliberately
// NOT the same list. An adult in crisis is not a child in crisis: the kids
// app's answer is "tell a grown-up you trust today", which is the right answer
// for a twelve-year-old and a useless one for a forty-year-old who has been
// carrying something alone for a decade. What an adult needs is a name, a
// number, and permission to use them.
//
// The patterns are wide on purpose. A false positive costs somebody one
// unnecessary card about where to get help; a false negative costs something
// that does not bear writing down.

const PATTERNS = [
  // Self-harm and suicidal ideation.
  /\bkill (?:myself|me)\b/i,
  /\bi (?:want|wanna|need) to die\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\btake my own life\b/i,
  /\b(?:cut|cutting|hurt|hurting|harm|harming) (?:myself|my ?self)\b/i,
  /\bi (?:don'?t|dont|do not) want to (?:live|be alive|exist|be here|wake up)\b/i,
  /\bno (?:reason|point) (?:to|in) (?:living|being here|carrying on|going on)\b/i,
  /\bend(?:ing)? it all\b/i,
  /\bbetter off (?:dead|without me)\b/i,
  /\beveryone would be better off\b/i,
  // Being harmed by someone else. Domestic abuse is the commonest thing an
  // adult brings to a church app and the hardest one to name out loud, so the
  // wordings people actually use matter more here than tidy phrasing.
  /\b(?:my |a )?(?:husband|wife|partner|boyfriend|girlfriend|spouse|father|mother|dad|mum|mom|son|daughter)\b[^.?!]{0,40}\b(?:hits?|hitting|beats?|beating|hurts?|hurting|chokes?|threatens?|threatening)\s+me\b/i,
  /\b(?:he|she|they)\s+(?:hits?|hitting|beats?|beating|chokes?|threatens?)\s+me\b/i,
  /\b(?:afraid|scared|frightened|terrified) (?:of|to go home)\b[^.?!]{0,30}\b(?:him|her|them|husband|wife|partner)\b/i,
  /\bdomestic (?:abuse|violence)\b/i,
  /\b(?:abused?|abusing|molest(?:ed|ing)?|raped?|assaulted)\b/i,
  /\bforces? me to\b[^.?!]{0,30}\b(?:sex|sleep with)\b/i,
  // Harm to someone else.
  /\b(?:hurt|kill|harm)\s+(?:my|the|him|her|them|someone)\b[^.?!]{0,20}\b(?:child|kids?|baby|wife|husband|partner)\b/i,
  /\bi (?:am|'m) going to hurt\b/i,
];

export function isConcerning(text) {
  return PATTERNS.some((pattern) => pattern.test(String(text || '')));
}

/**
 * What the card says.
 *
 * It does not counsel, it does not quote a verse, and it does not offer to
 * carry on the conversation. An app that answers "my husband hits me" with a
 * devotional has done harm. The only useful thing it has to say is: this is
 * bigger than an app, here is who to tell, and it is not your fault.
 */
export const SAFETY_CARD = {
  title: 'THIS IS BIGGER THAN AN APP.',
  body: [
    'What you have written is not something to work through with a piece of software, and it is not something you should be carrying on your own.',
    'Tell a real person this week — Pastor Fred or one of the FLCC leaders, a doctor, or somebody you trust. You will not be judged for it, and you are not the first. If the first person you tell does not hear you, tell another one.',
    'If you are in danger right now, or you are thinking about ending your life, use one of the numbers below before you do anything else. They are free, they are open now, and you do not need to know what to say before you call.',
  ],
  // Deliberately not scraped from a content file: these must work on a device
  // that has never had a connection, and they must not be editable by anything
  // that edits the devotionals.
  lines: [
    { name: 'Emergency services', detail: '999 (UK) · 911 (US) · 112 (EU)', number: '999' },
    { name: 'Samaritans — anything at all, any hour', number: '116 123' },
    { name: 'National Domestic Abuse Helpline', number: '0808 2000 247' },
    { name: 'If you are outside these countries', detail: 'findahelpline.com lists a free line for your country' },
  ],
};
