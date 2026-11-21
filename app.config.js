// One codebase, two apps. app.json holds everything they share; this file
// switches the few things that differ, from the APP_VARIANT setting:
//   (not set)  the customer app
//   pro        the professional app  (npm run pro)
// The app reads the choice at run time from `extra.variant` (src/lib/variant.js).
module.exports = ({ config }) => {
  const pro = process.env.APP_VARIANT === 'pro';
  const plugins = [
    ...(config.plugins ?? []),
    [
      'expo-image-picker',
      {
        cameraPermission: 'Take photos of your documents so our team can verify you.',
        photosPermission: 'Choose photos of your documents so our team can verify you.',
      },
    ],
  ];

  return {
    ...config,
    name: pro ? 'Handyman Pro' : config.name,
    // The pro app has its own link address, so sign-in returns to the right
    // app when both are installed. Add handymanpro://** to Supabase's
    // Redirect URLs before building the pro app for the stores.
    scheme: pro ? 'handymanpro' : config.scheme,
    plugins,
    extra: { ...config.extra, variant: pro ? 'pro' : 'customer' },
  };
};
