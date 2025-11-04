module.exports = {
  directories: {
    output: "dist",
    buildResources: "build"
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "main.js",
    "package.json"
  ],
  asar: true,
  mac: {
    target: "dmg",
    icon: "icon/icon.icns"
  },
  compression: "maximum"
};
