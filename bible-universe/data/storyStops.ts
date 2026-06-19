import type { StoryStop } from '@/types/bible';

/**
 * 16-stop cinematic journey from Creation to Revelation.
 * cameraOffset is [dx, dy, dz] from the node's world position.
 * duration is how long (ms) to hold AFTER the camera arrives.
 */
export const STORY_STOPS: StoryStop[] = [
  {
    nodeId: 'creation-event',
    narration: 'In the beginning God created the heavens and the earth. Light, life, and order from nothing — the world declared very good.',
    cameraOffset: [0, 220, 420],
    duration: 6000,
  },
  {
    nodeId: 'the-fall',
    narration: 'The serpent deceived; Adam disobeyed; and sin and death entered God\'s perfect creation. Yet God immediately promised a Rescuer — the seed of the woman who would crush the serpent\'s head.',
    cameraOffset: [60, 180, 360],
    duration: 6000,
  },
  {
    nodeId: 'the-flood',
    narration: 'God\'s judgment fell on a world consumed by evil, and grace preserved eight souls through the waters. The same pattern echoes through all of Scripture: judgment passed over, new life begins.',
    cameraOffset: [0, 200, 380],
    duration: 5500,
  },
  {
    nodeId: 'abraham',
    narration: 'From Ur of the Chaldeans, God called one man to leave everything. To Abraham He promised a people, a land, and the most staggering oath in history — that through his seed all nations of the earth would be blessed.',
    cameraOffset: [-60, 160, 320],
    duration: 6000,
  },
  {
    nodeId: 'the-passover',
    narration: 'The blood of a spotless lamb on the doorposts — and the angel of death passed over. This single night is the Old Testament\'s clearest window into the Cross: a substitute dies so the condemned may live.',
    cameraOffset: [0, 180, 340],
    duration: 6000,
  },
  {
    nodeId: 'the-exodus',
    narration: 'With a mighty hand and an outstretched arm, God shattered four hundred years of slavery. The Exodus became Israel\'s defining memory — the lens through which every act of divine rescue would be understood.',
    cameraOffset: [60, 160, 350],
    duration: 5500,
  },
  {
    nodeId: 'moses',
    narration: 'At Sinai the Law was given in fire and thunder — ten words that defined righteousness, exposed human sin, and pointed forward to the One who alone could fulfill them perfectly.',
    cameraOffset: [0, 180, 340],
    duration: 5500,
  },
  {
    nodeId: 'david',
    narration: 'A shepherd boy anointed king — and God made an unconditional promise: one of David\'s sons would reign on his throne forever. Every generation since has asked the same question: who is this eternal King?',
    cameraOffset: [-50, 150, 300],
    duration: 6000,
  },
  {
    nodeId: 'suffering-servant',
    narration: '"He was pierced for our transgressions, crushed for our iniquities." Seven centuries before the cross, Isaiah described the Messiah\'s death with a precision that no human author could achieve alone.',
    cameraOffset: [-80, 160, 310],
    duration: 7000,
  },
  {
    nodeId: 'fall-of-jerusalem',
    narration: 'Solomon\'s Temple burned. The glory departed. God\'s people were marched into Babylon. Yet in the darkest hour, Jeremiah announced the New Covenant — not stone tablets, but a law written on human hearts.',
    cameraOffset: [0, 200, 360],
    duration: 6000,
  },
  {
    nodeId: 'incarnation',
    narration: 'The eternal Word became flesh and dwelt among us. God himself stepped into human history as a helpless infant in Bethlehem. The hinge of the cosmos: eternity entering time.',
    cameraOffset: [-60, 140, 280],
    duration: 6000,
  },
  {
    nodeId: 'jesus',
    narration: 'Here is the center of all history — the Alpha and the Omega, the First and the Last. Every era before pointed to Him; every promise finds its Yes and Amen in Him. All of Scripture is a single story, and He is the ending it was always reaching toward.',
    cameraOffset: [0, 140, 380],
    duration: 8000,
  },
  {
    nodeId: 'crucifixion',
    narration: 'The Son of God stretched out His arms on the cross — bearing the wrath our sin deserved, satisfying divine justice, breaking the power of death. This is the axis of the universe.',
    cameraOffset: [0, 100, 240],
    duration: 7000,
  },
  {
    nodeId: 'resurrection',
    narration: 'On the third day the tomb was empty. Death could not hold the Author of Life. The resurrection is not merely a happy ending — it is the firstfruits guarantee that every believer will rise to immortal, glorified life.',
    cameraOffset: [40, 110, 250],
    duration: 6500,
  },
  {
    nodeId: 'pentecost',
    narration: 'Fifty days after the resurrection, the Holy Spirit fell like fire on 120 disciples — three thousand were saved, Babel\'s curse reversed, and the Church was born. The final age had begun.',
    cameraOffset: [-60, 120, 280],
    duration: 6000,
  },
  {
    nodeId: 'book-revelation',
    narration: '"He who testifies to these things says, I am coming soon." The story is not finished. The Rider on the white horse returns, the New Jerusalem descends, and God makes all things new. Maranatha — come, Lord Jesus.',
    cameraOffset: [0, 160, 320],
    duration: 7000,
  },
];
