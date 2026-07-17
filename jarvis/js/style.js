// The learned `style` preference (see learn.js) lived inside plan.js until
// V0.3; pulled out so any agent module can phrase a message without a
// circular import back through plan.js.
import { getPreference } from './memory.js';

export function currentStyle() {
  return getPreference('style', 'encouraging-first');
}

export function styleLine(encouraging, direct) {
  return currentStyle() === 'direct' ? direct : encouraging;
}
