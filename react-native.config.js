/**
 * See https://github.com/react-native-community/cli/blob/master/docs/configuration.md.
 *
 * To print the full config from the React Native CLI, run
 * `react-native config`.
 */
module.exports = {
  project: {
    android: {
      // Give the CLI a package-name value so it doesn't go looking for a
      // `package=` attribute in android/app/src/full/AndroidManifest.xml.
      // That'd be annoying, because we've chosen to put that attribute in
      // the `main` source set.
      //
      // This name won't match the app ID when the app ID has a suffix from
      // the build variant, e.g., with ".debug" or ".nonotifications" or
      // both. But we haven't (yet) seen an error that seems to stem from
      // that mismatch, and we don't (yet) see the RN doc explaining what
      // the CLI wants to do with the value, so let it be.
      packageName: 'com.zulipmobile',
    },
  },

  /**
   * See https://github.com/react-native-community/cli/blob/master/docs/dependencies.md.
   *
   * Currently, we only use this to blacklist some native-code
   * libraries, per-platform, that we don't want to be linked with
   * "autolinking".
   *
   * For more about "autolinking", see
   * https://github.com/react-native-community/cli/blob/master/docs/autolinking.md.
   */
  dependencies: {
    'react-native-vector-icons': {
      platforms: {
        // We're using a setup that doesn't involve linking
        // `VectorIconsPackage` on Android.
        android: null,
      },
    },
  },
};
