"use strict";

module.exports = {
  jobs: require("./jobs/state-machine"),
  auth: require("./auth"),
  uploadSessions: require("./uploads/sessions"),
  transferManager: require("./uploads/transfer-manager"),
};
