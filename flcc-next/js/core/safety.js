// Safety runs on the device, before anything is sent anywhere.
//
// When a message suggests self-harm, abuse, exploitation or danger, FLCC NEXT
// does not answer it — it replaces the answer with a card that names a trusted
// adult and the help lines. No model is called at all, so the path does not
// depend on a model behaving well.

const PATTERNS = [
  /\bkill (?:myself|me)\b/i,
  /\bi (?:want|wanna|need) to die\b/i,
  /\bsuicid(?:e|al)\b/i,
  /\b(?:cut|cutting|hurt|hurting|harm|harming) (?:myself|my ?self)\b/i,
  /\bi (?:don'?t|dont) want to (?:live|be alive|exist)\b/i,
  /\bbetter off (?:dead|without me)\b/i,
  /\b(?:someone|somebody|he|she|they|my \w+) (?:is )?(?:hurt|hurting|hit|hitting|beat|beating) (?:me|us)\b/i,
  /\b(?:touch(?:ed|ing)?|touches) me\b[^.?!]*\b(?:private|secret|down there|inappropriate)\b/i,
  /\b(?:private parts|inappropriately touched)\b/i,
  /\bmade me (?:keep|promise)\b[^.?!]*\bsecret\b/i,
  /\bsend (?:me )?(?:a )?(?:nude|naked)\b/i,
  /\b(?:abused?|abusing|molest(?:ed|ing)?|groom(?:ed|ing))\b/i,
  /\b(?:run|running) away from home\b/i,
];

export function isConcerning(text) {
  const message = String(text || '');
  return PATTERNS.some((pattern) => pattern.test(message));
}

export const SAFETY_CARD = {
  title: 'THIS MATTERS TOO MUCH FOR AN APP.',
  body: [
    'What you have written sounds heavy, and it is not something you should be carrying by yourself. It is not your fault.',
    'FLCC NEXT is an app, not a person — so the most useful thing it can say is: tell a grown-up you trust today. A parent, a guardian, a ministry leader, or a teacher. If the first person does not listen, tell another one.',
    'If you are in danger right now, or thinking about hurting yourself, use one of the numbers below straight away.',
  ],
};
