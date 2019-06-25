const { exec } = require("child_process");
const { promisify } = require("util");

const q = s => JSON.stringify(s);
const run = promisify(exec);

const notify = (message, title = "Notification", subtitle, sound) => {
  let cmd = `display notification ${q(message)} with title ${q(title)}`;
  if (subtitle) {
    cmd += ` subtitle ${q(subtitle)}`;
  }
  if (sound) {
    cmd += ` sound name ${q(sound)}`;
  }
  cmd = `osascript -e '${cmd.replace(/'/g, "\\'")}'`;
  return run(cmd);
};

module.exports = notify;
