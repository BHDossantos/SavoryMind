const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Nocturna shares constants/types outside the mobile project root.
config.watchFolders = [path.resolve(__dirname, '../shared')];
module.exports = config;
