// Child safety is a product requirement, tested like any other (SPEC.md §11).
//
// Detection runs on the device *before* a message is sent anywhere. When it
// fires, the child gets a safety card instead of a conversation — LAMP does not
// counsel, and the path does not depend on a model behaving well.

const PATTERNS = [
  // Self-harm and suicidal thinking
  /\bkill (?:myself|me)\b/i,
  /\b(?:end|ending) (?:my|it all)\b.*\blife\b/i,
  /\bi (?:want|wanna|need) to die\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\b(?:cut|cutting|hurt|hurting|harm|harming) (?:myself|my ?self)\b/i,
  /\bi (?:don'?t|dont) want to (?:live|be alive|exist)\b/i,
  /\bbetter off (?:dead|without me)\b/i,
  // Abuse, exploitation and danger from another person
  /\b(?:someone|somebody|he|she|they|my \w+) (?:is )?(?:hurt|hurting|hit|hitting|beat|beating) (?:me|us)\b/i,
  /\b(?:touch(?:ed|ing)?|touches) me\b.*\b(?:private|secret|down there|inappropriate)\b/i,
  /\b(?:private parts|inappropriately touched)\b/i,
  /\bmade me (?:keep|promise)\b[^.?!]*\bsecret\b/i,
  /\bsend (?:me )?(?:a )?(?:nude|naked)\b/i,
  /\bi (?:am|'m) (?:scared|afraid) (?:of|to go home)\b.*\b(?:dad|mum|mom|father|mother|uncle|stepdad|him|her)\b/i,
  /\b(?:abused?|abusing|molest(?:ed|ing)?|groom(?:ed|ing))\b/i,
  /\b(?:run|running) away from home\b/i,
  /\bnobody (?:is )?safe at home\b/i,
];

/** True when a message needs a safety card rather than an answer. */
export function isConcerning(text) {
  const message = String(text || '');
  return PATTERNS.some((pattern) => pattern.test(message));
}

export function matchedPatterns(text) {
  const message = String(text || '');
  return PATTERNS.filter((pattern) => pattern.test(message)).map(String);
}

/** What the card says. Never a diagnosis, never a plan, always a person. */
export function safetyCard(region) {
  return {
    title: 'This matters, and you should not carry it alone.',
    body: [
      'What you have just written sounds heavy. It is not your fault, and it is not something you have to sort out by yourself.',
      'LAMP is an app, not a person — so the most important thing it can tell you is to speak to a grown-up you trust today. A parent, a guardian, a pastor, a teacher, a school counsellor, or an aunt or uncle. If the first person you tell does not listen, tell another one.',
      'If you are in danger right now, or you are thinking about hurting yourself, contact one of the numbers below straight away.',
    ],
    verse: { ref: 'PSA.34.18', label: 'Psalm 34:18' },
    region,
  };
}
