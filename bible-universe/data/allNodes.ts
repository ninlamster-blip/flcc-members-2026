import type { BibleNode } from '@/types/bible';
import { PEOPLE }     from './nodes/people';
import { PLACES }     from './nodes/places';
import { EVENTS }     from './nodes/events';
import { BOOKS }      from './nodes/books';
import { PROPHECIES } from './nodes/prophecies';
import { DOCTRINES }  from './nodes/doctrines';

export const ALL_NODES: BibleNode[] = [
  ...PEOPLE,
  ...PLACES,
  ...EVENTS,
  ...BOOKS,
  ...PROPHECIES,
  ...DOCTRINES,
];

export { PEOPLE, PLACES, EVENTS, BOOKS, PROPHECIES, DOCTRINES };
