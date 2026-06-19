import type { PaulsJourney } from '@/types/bible';

/**
 * 4 Pauline missionary journeys.
 * lat/lng are real geographic coordinates, projected into 3D world space
 * by PaulsJourneyLayer — no external map library required.
 */
export const PAULS_JOURNEYS: PaulsJourney[] = [
  {
    id: 'journey-1',
    label: '1st Missionary Journey',
    color: '#00DDFF',
    period: '~AD 46–48',
    scriptureRef: 'Acts 13–14',
    waypoints: [
      { order: 1,  label: 'Antioch (Syria)',     lat: 36.20, lng: 36.15, scriptureRef: 'Acts 13:1-3',   description: 'Sent out by the Holy Spirit from the church at Antioch', placeId: 'antioch' },
      { order: 2,  label: 'Salamis (Cyprus)',     lat: 35.17, lng: 33.90, scriptureRef: 'Acts 13:5',    description: 'Proclaimed the word of God in the synagogues' },
      { order: 3,  label: 'Paphos (Cyprus)',      lat: 34.76, lng: 32.42, scriptureRef: 'Acts 13:6-12', description: 'Struck Elymas the sorcerer blind; proconsul Sergius Paulus believed' },
      { order: 4,  label: 'Perga',                lat: 36.96, lng: 30.85, scriptureRef: 'Acts 13:13',   description: 'John Mark departed back to Jerusalem' },
      { order: 5,  label: 'Antioch of Pisidia',   lat: 38.30, lng: 31.20, scriptureRef: 'Acts 13:14-52',description: 'Synagogue sermon on the history of Israel and the resurrection' },
      { order: 6,  label: 'Iconium',              lat: 37.87, lng: 32.50, scriptureRef: 'Acts 14:1-5',  description: 'Many Jews and Greeks believed; a plot to stone them discovered' },
      { order: 7,  label: 'Lystra',               lat: 37.57, lng: 32.24, scriptureRef: 'Acts 14:8-20', description: 'Paul healed a lame man; stoned and left for dead, yet rose up' },
      { order: 8,  label: 'Derbe',                lat: 37.40, lng: 33.38, scriptureRef: 'Acts 14:20-21',description: 'Preached and made many disciples' },
      { order: 9,  label: 'Attalia',              lat: 36.87, lng: 30.72, scriptureRef: 'Acts 14:25-26',description: 'Sailed back to Antioch, reporting all God had done' },
    ],
  },

  {
    id: 'journey-2',
    label: '2nd Missionary Journey',
    color: '#FFDD00',
    period: '~AD 49–51',
    scriptureRef: 'Acts 15:36–18:22',
    waypoints: [
      { order: 1,  label: 'Antioch (Syria)',      lat: 36.20, lng: 36.15, scriptureRef: 'Acts 15:36',   placeId: 'antioch' },
      { order: 2,  label: 'Lystra',               lat: 37.57, lng: 32.24, scriptureRef: 'Acts 16:1-3',  description: 'Timothy joined Paul as a co-worker' },
      { order: 3,  label: 'Troas',                lat: 39.79, lng: 26.20, scriptureRef: 'Acts 16:8-10', description: 'The Macedonian vision: "Come over and help us"' },
      { order: 4,  label: 'Philippi',             lat: 41.01, lng: 24.29, scriptureRef: 'Acts 16:12-40',description: 'Lydia converted; Paul and Silas imprisoned and freed by earthquake' },
      { order: 5,  label: 'Thessalonica',         lat: 40.64, lng: 22.94, scriptureRef: 'Acts 17:1-9',  description: 'Reasoned from the scriptures that Jesus is the Christ' },
      { order: 6,  label: 'Berea',                lat: 40.52, lng: 22.20, scriptureRef: 'Acts 17:10-15',description: 'The Bereans examined the Scriptures daily' },
      { order: 7,  label: 'Athens',               lat: 37.98, lng: 23.73, scriptureRef: 'Acts 17:16-34',description: 'Mars Hill sermon: "The Unknown God" — the God who made the world' },
      { order: 8,  label: 'Corinth',              lat: 37.94, lng: 22.93, scriptureRef: 'Acts 18:1-17', description: 'Stayed 18 months; wrote 1 & 2 Thessalonians' },
      { order: 9,  label: 'Ephesus',              lat: 37.94, lng: 27.34, scriptureRef: 'Acts 18:19-21',description: 'Brief visit; promised to return' },
      { order: 10, label: 'Caesarea',             lat: 32.50, lng: 34.90, scriptureRef: 'Acts 18:22',   description: 'Greeted the church; went up to Jerusalem' },
    ],
  },

  {
    id: 'journey-3',
    label: '3rd Missionary Journey',
    color: '#FF8800',
    period: '~AD 53–57',
    scriptureRef: 'Acts 18:23–21:17',
    waypoints: [
      { order: 1,  label: 'Antioch (Syria)',      lat: 36.20, lng: 36.15, scriptureRef: 'Acts 18:23',   placeId: 'antioch' },
      { order: 2,  label: 'Ephesus',              lat: 37.94, lng: 27.34, scriptureRef: 'Acts 19:1-41', description: 'Three years — the greatest church-planting season in history; riot of the silversmiths' },
      { order: 3,  label: 'Troas',                lat: 39.79, lng: 26.20, scriptureRef: 'Acts 20:6-12', description: 'Eutychus raised from the dead after falling from a window' },
      { order: 4,  label: 'Philippi',             lat: 41.01, lng: 24.29, scriptureRef: 'Acts 20:6' },
      { order: 5,  label: 'Corinth',              lat: 37.94, lng: 22.93, scriptureRef: 'Acts 20:2-3',  description: 'Spent three months; likely wrote Romans here' },
      { order: 6,  label: 'Miletus',              lat: 37.30, lng: 27.28, scriptureRef: 'Acts 20:17-38',description: 'Farewell address to the Ephesian elders — one of Paul\'s most moving speeches' },
      { order: 7,  label: 'Tyre',                 lat: 33.27, lng: 35.19, scriptureRef: 'Acts 21:3-6',  description: 'Disciples urged Paul through the Spirit not to go to Jerusalem' },
      { order: 8,  label: 'Caesarea',             lat: 32.50, lng: 34.90, scriptureRef: 'Acts 21:8-14', description: 'Agabus prophesied Paul\'s arrest; Paul pressed on regardless' },
      { order: 9,  label: 'Jerusalem',            lat: 31.78, lng: 35.23, scriptureRef: 'Acts 21:17',   description: 'Arrested in the temple courts; his Roman citizenship invoked', placeId: 'jerusalem' },
    ],
  },

  {
    id: 'journey-rome',
    label: 'Voyage to Rome',
    color: '#FF4488',
    period: '~AD 59–60',
    scriptureRef: 'Acts 27–28',
    waypoints: [
      { order: 1,  label: 'Caesarea',             lat: 32.50, lng: 34.90, scriptureRef: 'Acts 27:1-2',  description: 'Sailed as a prisoner under Julius the centurion' },
      { order: 2,  label: 'Sidon',                lat: 33.56, lng: 35.37, scriptureRef: 'Acts 27:3',    description: 'Julius kindly allowed Paul to go to his friends' },
      { order: 3,  label: 'Myra (Lycia)',         lat: 36.27, lng: 29.98, scriptureRef: 'Acts 27:5-6',  description: 'Changed ship for an Alexandrian vessel' },
      { order: 4,  label: 'Fair Havens (Crete)',  lat: 34.93, lng: 24.80, scriptureRef: 'Acts 27:8-12', description: 'Paul warned against sailing; the majority overruled him' },
      { order: 5,  label: 'Malta',                lat: 35.93, lng: 14.42, scriptureRef: 'Acts 28:1-10', description: 'Shipwrecked; Paul shook off a viper; healed the sick on the island' },
      { order: 6,  label: 'Syracuse (Sicily)',    lat: 37.08, lng: 15.28, scriptureRef: 'Acts 28:12',   description: 'Stayed three days' },
      { order: 7,  label: 'Puteoli',              lat: 40.83, lng: 14.10, scriptureRef: 'Acts 28:13-14',description: 'Found brothers and stayed seven days' },
      { order: 8,  label: 'Rome',                 lat: 41.90, lng: 12.50, scriptureRef: 'Acts 28:16-31',description: 'Two years under house arrest — preaching the Kingdom and teaching about Jesus freely', placeId: 'rome' },
    ],
  },
];
