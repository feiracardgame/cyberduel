process.env.CYBERDUEL_DEBUG = "1";
process.env.CYBERDUEL_LOCAL_LOGIN = "1";
process.env.DATA_DIR ||= require("node:path").join(__dirname, "../server/data-dev");
require("../server/server.js");
