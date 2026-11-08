/**
 * Public Firebase web config (safe to ship: access is controlled by Firestore security rules and
 * everything stored is encrypted on the device). Filled in from `firebase apps:sdkconfig`.
 */
export const FIREBASE = {
  apiKey: 'AIzaSyDUQTSzBxHU3aWTV4FH4JbN-nMdYGNF6Xk',
  projectId: 'daybook-sync-9285',
};

/** Accounts only show up once the project is configured. */
export const SYNC_AVAILABLE = FIREBASE.apiKey !== '' && FIREBASE.projectId !== '';
