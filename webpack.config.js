const path = require("path");

module.exports = {
  mode: "production",
  entry: {
    background: "./src/background.js",
    popup: "./src/popup.js"
  },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist")
  },
  resolve: {
    extensions: [".js"]
  }
};