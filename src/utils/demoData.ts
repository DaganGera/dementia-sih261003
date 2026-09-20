import {
  CaregiverProfile,
  ElderlyProfile,
  FamiliarPerson,
  FamiliarPlace,
  RoutineItem,
  Reminder,
  GameSession,
  DeviceConnection,
  NotificationItem,
  PatientProfile,
} from '../types';

export const INITIAL_CAREGIVER_PROFILE: CaregiverProfile = {
  id: 'cg-demo-1',
  userId: 'user-caregiver-1',
  name: 'Anitha Sharma',
  age: 42,
  relationshipWithElderly: 'Daughter',
  phone: '+91 98765 43210',
  preferredLanguage: 'English',
  photoUrl: 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=400&q=80',
};

export const INITIAL_ELDERLY_PROFILE: ElderlyProfile = {
  id: 'eld-demo-1',
  caregiverId: 'cg-demo-1',
  name: 'Meena Sharma',
  age: 74,
  state: 'Assam',
  preferredLanguage: 'as',
  emergencyContact: '+91 98765 43210 (Daughter Anitha)',
  caregiverName: 'Anitha',
  dailyWakeUpTime: '07:00 AM',
  preferredActivityTime: '10:30 AM',
  photoUrl: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
};

export const INITIAL_PATIENT_PROFILE: PatientProfile = {
  id: 'pat-demo-1',
  basicInfo: {
    name: 'Meena Sharma',
    dateOfBirth: '1952-05-14',
    age: 74,
    gender: 'Female',
    state: 'Assam',
    language: 'as',
    photo: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
  },
  medicalHistory: {
    conditions: [
      { id: 'mc-1', name: 'Hypertension', diagnosedYear: 2015, notes: 'Managed with daily medication' },
      { id: 'mc-2', name: 'Mild Cognitive Concerns', diagnosedYear: 2023, notes: 'Requires routine reminders & memory exercises' },
    ],
    neurologicalHistory: ['Routine neurological evaluation completed in 2023'],
    surgeries: ['Cataract surgery (2021)'],
    hospitalizations: ['Brief hospitalization for dehydration (2022)'],
    allergies: ['Penicillin'],
    visionDifficulties: false,
    hearingDifficulties: true,
    speechDifficulties: false,
    mobilityLimitations: false,
    sleepDifficulties: true,
    notes: 'Enjoys morning tea in the garden; benefits from routine structure.',
    documents: [
      { id: 'doc-1', name: 'Routine Care & Prescription Summary', type: 'prescription', dateAdded: '2026-01-15' },
      { id: 'doc-2', name: 'Health Evaluation Report', type: 'report', dateAdded: '2025-11-20' },
    ],
  },
  medications: [
    {
      id: 'med-1',
      name: 'Amlodipine',
      dosage: '5mg',
      frequency: 'Daily',
      time: '08:00 AM',
      purpose: 'Blood pressure reference',
      doctorName: 'Dr. P. Barua',
      notes: 'Take after breakfast',
    },
    {
      id: 'med-2',
      name: 'Multivitamin Supplement',
      dosage: '1 tablet',
      frequency: 'Daily',
      time: '01:00 PM',
      purpose: 'General wellness',
      doctorName: 'Dr. P. Barua',
      notes: 'Take with water after lunch',
    },
  ],
  dailyRoutine: [
    { id: 'r-1', time: '07:00 AM', activity: 'Wake up & Gentle Breathing', category: 'morning', description: 'Warm water & bedroom window opening' },
    { id: 'r-2', time: '08:00 AM', activity: 'Breakfast & Medication', category: 'morning', description: 'Healthy porridge and daily reference item' },
    { id: 'r-3', time: '10:30 AM', activity: 'Daughter Anitha Visit & Cognitive Activity', category: 'morning', description: 'Memory match or sequence game' },
    { id: 'r-4', time: '01:00 PM', activity: 'Lunch & Afternoon Rest', category: 'afternoon', description: 'Nutritious lunch followed by 45 min rest' },
    { id: 'r-5', time: '05:30 PM', activity: 'Garden Walk', category: 'evening', description: '20 minute light stroll in flower garden' },
    { id: 'r-6', time: '09:30 PM', activity: 'Night Sleep Routine', category: 'night', description: 'Calming music and lights out' },
  ],
  cognitiveProfile: {
    memory: 72,
    attention: 61,
    recognition: 81,
    recall: 53,
    language: 70,
    familiarity: 85,
  },
  dailyFunction: {
    memoryDifficulty: 'occasional',
    attentionDifficulty: 'occasional',
    peopleRecognitionDifficulty: 'none',
    placeRecognitionDifficulty: 'none',
    routineDifficulty: 'occasional',
    communicationDifficulty: 'none',
    dailyTaskDifficulty: 'occasional',
  },
  caregiverObservations: [
    'Remembers family photos with high accuracy',
    'Responds enthusiastically to voice-guided regional stories',
    'Prefers visual activity prompts over text-heavy instructions',
  ],
  emergencyContact: {
    primaryContactName: 'Anitha Sharma',
    primaryContactPhone: '+91 98765 43210',
    primaryCaregiverName: 'Anitha Sharma (Daughter)',
    doctorName: 'Dr. P. Barua',
    hospitalName: 'Guwahati Care Center Clinic',
    allergies: ['Penicillin'],
    importantNotes: 'Only contact Anitha during emergency situations.',
  },
  accessibility: {
    largeText: true,
    highContrast: false,
    voiceEnabled: true,
    reduceMotion: false,
  },
  gamification: {
    xp: 245,
    mindPoints: 180,
    userLevel: 4,
    currentStreak: 5,
    lastActiveDate: new Date().toISOString().split('T')[0],
    unlockedBadges: [],
  },
  patientCredentials: {
    loginId: 'meena.sharma',
    password: 'patient123',
  },
};

export const INITIAL_FAMILIAR_PEOPLE: FamiliarPerson[] = [];

export const INITIAL_FAMILIAR_PLACES: FamiliarPlace[] = [];

export const INITIAL_ROUTINE: RoutineItem[] = INITIAL_PATIENT_PROFILE.dailyRoutine;

export const INITIAL_REMINDERS: Reminder[] = [];

export const INITIAL_GAME_SESSIONS: GameSession[] = [
  {
    id: 'gs-1',
    gameId: 'memory-match',
    gameTitle: '🧩 Memory Match',
    category: 'memory',
    score: 88,
    accuracy: 85,
    timeSeconds: 42,
    difficultyLevel: 2,
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    attempts: 4,
  },
  {
    id: 'gs-2',
    gameId: 'name-face',
    gameTitle: '👤 Who Is This?',
    category: 'recognition',
    score: 95,
    accuracy: 100,
    timeSeconds: 28,
    difficultyLevel: 2,
    timestamp: new Date(Date.now() - 3600000 * 48).toISOString(),
    attempts: 3,
  },
  {
    id: 'gs-3',
    gameId: 'familiar-places',
    gameTitle: '🏠 Familiar Places',
    category: 'familiarity',
    score: 90,
    accuracy: 90,
    timeSeconds: 35,
    difficultyLevel: 2,
    timestamp: new Date(Date.now() - 3600000 * 72).toISOString(),
    attempts: 3,
  },
];

export const INITIAL_DEVICE_CONNECTION: DeviceConnection = {
  id: 'conn-demo-1',
  token: 'TOKEN-SIH-2026-NER-CARE',
  caregiverName: 'Anitha Sharma',
  elderlyName: 'Meena Sharma',
  connectedAt: new Date().toISOString(),
  status: 'online',
  lastSync: new Date().toISOString(),
};

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    title: 'Cognitive Session Complete',
    message: 'Meena achieved 85% accuracy in Memory Match.',
    type: 'success',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Morning Routine Reminder',
    message: 'Breakfast routine item logged for today.',
    type: 'info',
    timestamp: new Date(Date.now() - 3600000 * 5).toISOString(),
    read: true,
  },
];
