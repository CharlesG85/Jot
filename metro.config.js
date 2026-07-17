const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Let Metro bundle the CREPE .onnx model as a binary asset rather than
// trying to parse it as source.
config.resolver.assetExts.push('onnx');

module.exports = config;
