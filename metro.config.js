const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Let Metro bundle the CREPE .onnx model, and bundled SoundFont instrument
// samples, as binary assets rather than trying to parse them as source.
config.resolver.assetExts.push('onnx', 'sf2');

module.exports = config;
