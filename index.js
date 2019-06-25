const child_process = require("child_process");
const config = require('./config');


const abbreviateReviewerName = reviewer => {
  const parts = reviewer.user.displayName.split(" ");
  // special case to get victor's name down to 2 letters
  return parts[0][0] + parts[parts.length - 1][0];
};

const parseResponse = (error, stdout, stderr) => {
  if (error) {
    console.error(error);
    return null;
  }

  try {
    return JSON.parse(stdout);
  } catch (e) {
    console.error(e);
  }
  return null;
};

const checkConfig = config => {
  let configOk = true;
  Object.keys(config).forEach(k => {
    if (!config[k]) {
      configOk = false;
    }
  });
  return configOk;
};


if (!checkConfig(config)) {
  console.error("Please add your settings to config.js");
  process.exit(-1);
}

if (!child_process.execSync("which curl")) {
  console.error("This cool script requires curl to be installed in your path. Please install it and try again");
  process.exit(-1);
}


const authorizationHeader = `Authorization: Bearer ${config.token}`;

const prUrl =
  `${config.baseUrl}/rest/api/1.0/projects/${config.project}/repos/${config.repo}/pull-requests`;
const cmd = `curl -H "Content-Type: application/json" -H "${authorizationHeader}" ${prUrl}`;


child_process.exec(cmd, (error, stdout, stderr) => {
  const response = parseResponse(error, stdout, stderr);
  if (!response) {
    console.error("bailing out...");
    return;
  }
  const keys = ["id", "state", "open", "closed", "title"];

  const whiteAnsiColor = 37;
  const greenAnsiColor = 42;
  const yellowAnsiColor = 43;

  response.values.forEach((pr, index) => {
    const cmd = `curl -H "Content-Type: application/json" -H "${authorizationHeader}" ${prUrl}/${
      pr.id
    }`;
    child_process.exec(cmd, (error, stdout, stderr) => {
      const response = parseResponse(error, stdout, stderr);
      if (!response) {
        console.error(error);
        return;
      }

      const approvers = response.reviewers.filter(r => r.approved);
      const approverNames = approvers
        .map(abbreviateReviewerName)
        .map(name => "\x1b[" + greenAnsiColor + ";30m " + name + " \x1b[0m")
        .join(" ");

      const unapprovers = response.reviewers.filter(r => !r.approved);
      const unapproverNames = unapprovers
        .map(abbreviateReviewerName)
        .map(name => "\x1b[" + yellowAnsiColor + ";30m " + name + " \x1b[0m")
        .join(" ");

      const author = response.author.user.displayName;

      console.log("\n");
      
      console.log(
        `[${response.id}] ${response.title}  [${
          response.author.user.name === config.username
            ? "\x1b[" + whiteAnsiColor + ";1m" + author + "\x1b[0m"
            : author
        }]`
      );
      console.log(
        "UNAPPROVED  %s  %s",
        (unapprovers.length < 10 ? " (" : "(") + unapprovers.length + ")",
        unapproverNames
      );
      console.log(
        "APPROVED    %s  %s",
        (approvers.length < 10 ? " (" : "(") + approvers.length + ")",
        approverNames
      );

    });
  });
});
