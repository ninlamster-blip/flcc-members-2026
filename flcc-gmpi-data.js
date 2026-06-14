// FLCC-GMPI Prayer Map - Church Data
// Edit in Admin panel; changes persist via localStorage

const INITIAL_CHURCHES = [
  // ─── NCR (Metro Manila) ───────────────────────────────────────────
  {
    id: 1,
    name: "FLCC Sampaloc",
    city: "Manila",
    province: "Metro Manila",
    region: "NCR",
    island_group: "Luzon",
    coordinates: [14.6060, 120.9920],
    lead_pastor: "Rev. Jose Santos",
    contact_phone: "+63 917 123 4501",
    contact_email: "flcc.sampaloc@gmail.com",
    year_established: 1998,
    members: 285,
    status: "stable",
    ministry_type: "church",
    needs: ["Projector upgrade", "Nursery volunteers"],
    prayer_requests: [
      "Continued growth and discipleship",
      "Youth ministry expansion",
      "Building renovation fund"
    ]
  },
  {
    id: 2,
    name: "FLCC Cubao",
    city: "Quezon City",
    province: "Metro Manila",
    region: "NCR",
    island_group: "Luzon",
    coordinates: [14.6183, 121.0548],
    lead_pastor: "Rev. Andrew Villanueva",
    contact_phone: "+63 918 234 5602",
    contact_email: "flcc.cubao@gmail.com",
    year_established: 2005,
    members: 190,
    status: "stable",
    ministry_type: "church",
    needs: ["Sound system repair", "Children's ministry materials"],
    prayer_requests: [
      "Church multiplication strategy",
      "City-wide outreach campaign",
      "Pastoral staff support"
    ]
  },

  // ─── Region III (Central Luzon) ──────────────────────────────────
  {
    id: 3,
    name: "FLCC San Fernando",
    city: "San Fernando",
    province: "Pampanga",
    region: "Region III",
    island_group: "Luzon",
    coordinates: [15.0286, 120.6899],
    lead_pastor: "Ptr. Sarah Dizon",
    contact_phone: "+63 919 345 6703",
    contact_email: "flcc.sanfernando@gmail.com",
    year_established: 2010,
    members: 120,
    status: "needs_support",
    ministry_type: "church",
    needs: ["Worship instruments (drums, bass guitar)", "Chairs (50 units)", "AC unit for main hall"],
    prayer_requests: [
      "New families to join the congregation",
      "Financial provision for rent",
      "Outreach to nearby barangays"
    ]
  },
  {
    id: 4,
    name: "GMPI Mission Tarlac",
    city: "Tarlac City",
    province: "Tarlac",
    region: "Region III",
    island_group: "Luzon",
    coordinates: [15.4877, 120.5960],
    lead_pastor: "Ptr. Cornelio Reyes",
    contact_phone: "+63 920 456 7804",
    contact_email: "gmpi.tarlac@gmail.com",
    year_established: 2018,
    members: 45,
    status: "needs_support",
    ministry_type: "mission",
    needs: ["Monthly support (₱8,000)", "Bible study materials", "Transportation assistance"],
    prayer_requests: [
      "Stable meeting place",
      "More committed members",
      "Partner churches for support"
    ]
  },

  // ─── Region IV-A (CALABARZON) ────────────────────────────────────
  {
    id: 5,
    name: "FLCC Batangas City",
    city: "Batangas City",
    province: "Batangas",
    region: "Region IV-A",
    island_group: "Luzon",
    coordinates: [13.7565, 121.0584],
    lead_pastor: "Ptr. James Garcia",
    contact_phone: "+63 921 567 8905",
    contact_email: "flcc.batangas@gmail.com",
    year_established: 2003,
    members: 165,
    status: "stable",
    ministry_type: "church",
    needs: ["Sound system upgrade", "Baptismal facility"],
    prayer_requests: [
      "Soul winning in harbor communities",
      "Leadership training program",
      "Children's church building"
    ]
  },
  {
    id: 6,
    name: "FLCC Lucena City",
    city: "Lucena City",
    province: "Quezon",
    region: "Region IV-A",
    island_group: "Luzon",
    coordinates: [13.9319, 121.6170],
    lead_pastor: "Ptr. Joel Flores",
    contact_phone: "+63 922 678 9006",
    contact_email: "flcc.lucena@gmail.com",
    year_established: 2008,
    members: 98,
    status: "needs_support",
    ministry_type: "church",
    needs: ["Keyboard/piano", "Ministry vehicle", "Financial workers needed"],
    prayer_requests: [
      "Healing for lead pastor (hypertension)",
      "Breakthrough in membership growth",
      "Outreach in Quezon province towns"
    ]
  },

  // ─── CAR (Cordillera) ─────────────────────────────────────────────
  {
    id: 7,
    name: "FLCC Baguio City",
    city: "Baguio City",
    province: "Benguet",
    region: "CAR",
    island_group: "Luzon",
    coordinates: [16.4023, 120.5960],
    lead_pastor: "Ptr. David Aguilar",
    contact_phone: "+63 923 789 1107",
    contact_email: "flcc.baguio@gmail.com",
    year_established: 2001,
    members: 210,
    status: "stable",
    ministry_type: "church",
    needs: ["Heaters for winter season", "Outreach funds for mountain communities"],
    prayer_requests: [
      "Student ministry at UP Baguio and SLU",
      "Mission to Cordillera tribes",
      "Building expansion for growing congregation"
    ]
  },

  // ─── Region V (Bicol) ─────────────────────────────────────────────
  {
    id: 8,
    name: "FLCC Legazpi City",
    city: "Legazpi City",
    province: "Albay",
    region: "Region V",
    island_group: "Luzon",
    coordinates: [13.1391, 123.7437],
    lead_pastor: "Ptr. Rachel Bautista",
    contact_phone: "+63 924 890 2208",
    contact_email: "flcc.legazpi@gmail.com",
    year_established: 2012,
    members: 75,
    status: "needs_support",
    ministry_type: "church",
    needs: ["Typhoon preparedness fund", "Disaster relief materials", "Generator"],
    prayer_requests: [
      "Protection from Mayon Volcano hazards",
      "Rebuilding after typhoon damage",
      "Evangelism in Bikol communities"
    ]
  },

  // ─── Region VI (Western Visayas) ─────────────────────────────────
  {
    id: 9,
    name: "FLCC Iloilo City",
    city: "Iloilo City",
    province: "Iloilo",
    region: "Region VI",
    island_group: "Visayas",
    coordinates: [10.7202, 122.5621],
    lead_pastor: "Ptr. Emmanuel Cruz",
    contact_phone: "+63 925 901 3309",
    contact_email: "flcc.iloilo@gmail.com",
    year_established: 2007,
    members: 88,
    status: "urgent",
    ministry_type: "church",
    needs: ["Emergency financial support", "Temporary worship space", "Volunteer workers urgently needed"],
    prayer_requests: [
      "URGENT: Church building lease not renewed — needs new location",
      "Lead pastor's wife hospitalized (cancer)",
      "Flock unity during this crisis",
      "Provision of miracle location within 30 days"
    ]
  },
  {
    id: 10,
    name: "GMPI Mission Roxas City",
    city: "Roxas City",
    province: "Capiz",
    region: "Region VI",
    island_group: "Visayas",
    coordinates: [11.5854, 122.7510],
    lead_pastor: "Ptr. Mark Evangelista",
    contact_phone: "+63 926 012 4410",
    contact_email: "gmpi.roxas@gmail.com",
    year_established: 2020,
    members: 32,
    status: "needs_support",
    ministry_type: "mission",
    needs: ["Monthly missionary support (₱6,000)", "Bibles (100 copies)", "Children's curriculum"],
    prayer_requests: [
      "Mission house construction",
      "Reaching fisherfolk communities",
      "New believers' discipleship"
    ]
  },

  // ─── Region VII (Central Visayas) ────────────────────────────────
  {
    id: 11,
    name: "FLCC Cebu City",
    city: "Cebu City",
    province: "Cebu",
    region: "Region VII",
    island_group: "Visayas",
    coordinates: [10.3157, 123.8854],
    lead_pastor: "Ptr. Grace Lim",
    contact_phone: "+63 927 123 5511",
    contact_email: "flcc.cebu@gmail.com",
    year_established: 1999,
    members: 320,
    status: "stable",
    ministry_type: "church",
    needs: ["Worship team training", "Livestream equipment"],
    prayer_requests: [
      "Church planting in Mandaue and Lapu-Lapu",
      "Urban poor ministry expansion",
      "Annual conventions and conferences"
    ]
  },
  {
    id: 12,
    name: "GMPI Mission Tagbilaran",
    city: "Tagbilaran City",
    province: "Bohol",
    region: "Region VII",
    island_group: "Visayas",
    coordinates: [9.6573, 123.8544],
    lead_pastor: "Ptr. Noah Torres",
    contact_phone: "+63 928 234 6612",
    contact_email: "gmpi.bohol@gmail.com",
    year_established: 2016,
    members: 55,
    status: "needs_support",
    ministry_type: "mission",
    needs: ["Island boat transport for outreach", "Solar panels for remote chapel", "Medical mission funds"],
    prayer_requests: [
      "Reaching Chocolate Hills communities",
      "Discipleship of new converts",
      "Partnerships with local government"
    ]
  },

  // ─── Region VIII (Eastern Visayas) ───────────────────────────────
  {
    id: 13,
    name: "FLCC Tacloban City",
    city: "Tacloban City",
    province: "Leyte",
    region: "Region VIII",
    island_group: "Visayas",
    coordinates: [11.2543, 125.0000],
    lead_pastor: "Ptr. Ruth Mendoza",
    contact_phone: "+63 929 345 7713",
    contact_email: "flcc.tacloban@gmail.com",
    year_established: 2006,
    members: 110,
    status: "urgent",
    ministry_type: "church",
    needs: ["URGENT: Typhoon-damaged roof repair (₱250,000)", "Counseling resources", "Food packs for members"],
    prayer_requests: [
      "URGENT: 3 church families lost homes in recent typhoon",
      "Healing and recovery for trauma survivors",
      "Miracle provision for roof rebuilding",
      "Strength for lead pastor during hardship"
    ]
  },
  {
    id: 14,
    name: "GMPI Mission Ormoc City",
    city: "Ormoc City",
    province: "Leyte",
    region: "Region VIII",
    island_group: "Visayas",
    coordinates: [11.0054, 124.6075],
    lead_pastor: "Ptr. Esther Ocampo",
    contact_phone: "+63 930 456 8814",
    contact_email: "gmpi.ormoc@gmail.com",
    year_established: 2019,
    members: 28,
    status: "needs_support",
    ministry_type: "mission",
    needs: ["Church planter monthly support", "Transport for cell group visits", "Musical instruments"],
    prayer_requests: [
      "Breakthrough in traditional Catholic barangays",
      "Cell group leaders raised up",
      "Finances for missionary family"
    ]
  },

  // ─── Region X (Northern Mindanao) ────────────────────────────────
  {
    id: 15,
    name: "FLCC Cagayan de Oro",
    city: "Cagayan de Oro City",
    province: "Misamis Oriental",
    region: "Region X",
    island_group: "Mindanao",
    coordinates: [8.4542, 124.6319],
    lead_pastor: "Ptr. Maria Santos",
    contact_phone: "+63 931 567 9915",
    contact_email: "flcc.cdo@gmail.com",
    year_established: 2004,
    members: 240,
    status: "stable",
    ministry_type: "church",
    needs: ["Youth hall renovation", "Campus ministry budget"],
    prayer_requests: [
      "Gateway city for Mindanao church planting",
      "CDO University outreach",
      "Revival in Northern Mindanao"
    ]
  },
  {
    id: 16,
    name: "GMPI Mission Iligan City",
    city: "Iligan City",
    province: "Lanao del Norte",
    region: "Region X",
    island_group: "Mindanao",
    coordinates: [8.2280, 124.2452],
    lead_pastor: "Ptr. Lydia Tan",
    contact_phone: "+63 932 678 0016",
    contact_email: "gmpi.iligan@gmail.com",
    year_established: 2015,
    members: 62,
    status: "needs_support",
    ministry_type: "mission",
    needs: ["Security funds for sensitive area", "Maranao language Bibles", "Intercultural training"],
    prayer_requests: [
      "Peaceful coexistence and witness among Muslim neighbors",
      "Protection for missionary family",
      "Breakthrough conversions in Maranao community"
    ]
  },

  // ─── Region XI (Davao Region) ─────────────────────────────────────
  {
    id: 17,
    name: "FLCC Davao City",
    city: "Davao City",
    province: "Davao del Sur",
    region: "Region XI",
    island_group: "Mindanao",
    coordinates: [7.1907, 125.4553],
    lead_pastor: "Rev. Michael Reyes",
    contact_phone: "+63 933 789 1117",
    contact_email: "flcc.davao@gmail.com",
    year_established: 1997,
    members: 380,
    status: "stable",
    ministry_type: "church",
    needs: ["Building expansion (Phase 3)", "Seminary scholarship fund"],
    prayer_requests: [
      "Regional leadership hub for Mindanao",
      "Planting 10 churches in Davao Region by 2028",
      "Annual GMPI Mindanao Conference"
    ]
  },

  // ─── Region XII (SOCCSKSARGEN) ────────────────────────────────────
  {
    id: 18,
    name: "FLCC General Santos City",
    city: "General Santos City",
    province: "South Cotabato",
    region: "Region XII",
    island_group: "Mindanao",
    coordinates: [6.1164, 125.1716],
    lead_pastor: "Rev. Paul Aquino",
    contact_phone: "+63 934 890 2218",
    contact_email: "flcc.gensan@gmail.com",
    year_established: 2002,
    members: 175,
    status: "stable",
    ministry_type: "church",
    needs: ["Tuna port community outreach budget", "Church van"],
    prayer_requests: [
      "Fishing community evangelism",
      "Youth ministry multiplication",
      "Missions to Lake Sebu tribes"
    ]
  },
  {
    id: 19,
    name: "GMPI Mission Koronadal",
    city: "Koronadal City",
    province: "South Cotabato",
    region: "Region XII",
    island_group: "Mindanao",
    coordinates: [6.5028, 124.8474],
    lead_pastor: "Ptr. Samuel Perez",
    contact_phone: "+63 935 901 3319",
    contact_email: "gmpi.koronadal@gmail.com",
    year_established: 2017,
    members: 38,
    status: "needs_support",
    ministry_type: "mission",
    needs: ["House of prayer / office space", "Evangelism tracts", "Children's feeding program"],
    prayer_requests: [
      "Blaan and T'boli tribal missions",
      "Monthly provision for pastor's family",
      "Medical outreach support"
    ]
  },

  // ─── Region IX (Zamboanga Peninsula) ─────────────────────────────
  {
    id: 20,
    name: "GMPI Mission Zamboanga City",
    city: "Zamboanga City",
    province: "Zamboanga del Sur",
    region: "Region IX",
    island_group: "Mindanao",
    coordinates: [6.9214, 122.0790],
    lead_pastor: "Ptr. John Dela Cruz",
    contact_phone: "+63 936 012 4420",
    contact_email: "gmpi.zamboanga@gmail.com",
    year_established: 2014,
    members: 42,
    status: "urgent",
    ministry_type: "mission",
    needs: ["URGENT: Security concerns require relocation", "Emergency housing", "Immediate financial aid"],
    prayer_requests: [
      "URGENT: Missionary family received threats — seeking safe relocation",
      "Divine protection and angels of God",
      "Courage to continue the mission",
      "Intercession from the whole FLCC-GMPI network"
    ]
  },

  // ─── Region XIII (Caraga) ─────────────────────────────────────────
  {
    id: 21,
    name: "GMPI Mission Butuan City",
    city: "Butuan City",
    province: "Agusan del Norte",
    region: "Region XIII",
    island_group: "Mindanao",
    coordinates: [8.9475, 125.5406],
    lead_pastor: "Ptr. Timothy Ramos",
    contact_phone: "+63 937 123 5521",
    contact_email: "gmpi.butuan@gmail.com",
    year_established: 2021,
    members: 22,
    status: "urgent",
    ministry_type: "outreach",
    needs: ["URGENT: No permanent meeting place", "Monthly budget (₱7,000)", "Discipleship mentor needed"],
    prayer_requests: [
      "URGENT: Core group of 22 members meeting in a home — needs church space",
      "Spiritual maturity for new believers",
      "Partnership with mother church",
      "Vision and direction for this new work"
    ]
  },

  // ─── BARMM ────────────────────────────────────────────────────────
  {
    id: 22,
    name: "GMPI Mission Cotabato City",
    city: "Cotabato City",
    province: "Maguindanao del Norte",
    region: "BARMM",
    island_group: "Mindanao",
    coordinates: [7.2236, 124.2490],
    lead_pastor: "Ptr. Daniel Rivera",
    contact_phone: "+63 938 234 6622",
    contact_email: "gmpi.cotabato@gmail.com",
    year_established: 2019,
    members: 18,
    status: "urgent",
    ministry_type: "outreach",
    needs: ["URGENT: Medical support for pastor (serious illness)", "Security escorts", "Maranao/Maguindanaon Bibles"],
    prayer_requests: [
      "URGENT: Lead pastor hospitalized with serious condition",
      "Protection and peace in conflict-affected area",
      "Successor raised up if pastor cannot continue",
      "Miracle healing for Ptr. Daniel"
    ]
  }
];

// ── Persistence helpers ──────────────────────────────────────────────────────

function loadChurches() {
  try {
    const saved = localStorage.getItem('flcc_gmpi_churches_v1');
    if (saved) return JSON.parse(saved);
  } catch (e) { /* fall through */ }
  return INITIAL_CHURCHES.map(c => ({ ...c }));
}

function saveChurches(data) {
  localStorage.setItem('flcc_gmpi_churches_v1', JSON.stringify(data));
}

function resetChurches() {
  localStorage.removeItem('flcc_gmpi_churches_v1');
  return INITIAL_CHURCHES.map(c => ({ ...c }));
}
