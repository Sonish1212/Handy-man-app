import Constants from 'expo-constants';

// Which of the two apps this is: the customer app or the professional app.
// Set by app.config.js from APP_VARIANT when Expo starts (npm run pro).
export const isProApp = Constants.expoConfig?.extra?.variant === 'pro';
