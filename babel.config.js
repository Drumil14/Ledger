// Matches Expo's default (babel-preset-expo auto-configures Reanimated worklets
// on SDK 54+); declared explicitly so Jest's babel-jest can find a preset.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
