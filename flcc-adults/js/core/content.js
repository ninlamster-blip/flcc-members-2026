// Authored content: JSON under content/, fetched once per session.
//
// Content is data. Nothing here is executed, and nothing from it is handed to
// a model as instructions.
//
// Unlike the kids and teens app there is no editing layer over the top of it.
// That app has a ministry dashboard because a leader writing for minors needs
// one; here, content is written by the teaching team, reviewed in a pull
// request, and deployed — which is the honest description of how an adult
// discipleship curriculum actually gets approved.

const cache = new Map();

function fetchJson(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(new URL(`../../content/${path}`, import.meta.url))
    .then((response) => {
      if (!response.ok) throw new Error(`Content missing: ${path} (HTTP ${response.status})`);
      return response.json();
    })
    .catch((error) => { cache.delete(path); throw error; });
  cache.set(path, promise);
  return promise;
}

export const load = (path) => fetchJson(path);

export const moments   = () => load('moments.json');        // the daily Scripture moment
export const paths     = () => load('paths.json');          // the learning paths
export const sessions  = (id) => load(`paths/${id}.json`);  // one path's sessions
export const guides    = () => load('prayer-guides.json');  // guided prayer
export const categories = () => load('prayer-categories.json');
export const plans     = () => load('reading-plans.json');
export const updates   = () => load('updates.json');
export const events    = () => load('events.json');
export const ministries = () => load('ministries.json');
