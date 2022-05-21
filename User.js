const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
  },
  email: {
    type: String,
  },
  password: {
    type: String,
  },
  requests: {
    type: [mongoose.SchemaTypes.ObjectID],
    ref: "Request",
  },
});

module.exports = mongoose.model("User", userSchema);
