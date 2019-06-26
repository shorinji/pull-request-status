const https = require("https");
const config = require("./config");

const abbreviateReviewerName = reviewer => {
  const parts = reviewer.user.displayName.split(" ");
  // special case to get victor's name down to 2 letters
  return parts[0][0] + parts[parts.length - 1][0];
};

const parseResponse = (httpResponse, callback) => {
  let body = "";
  httpResponse.on("data", chunk => {
    body += chunk;
  });

  httpResponse.on("end", () => {
    callback(JSON.parse(body));
  });
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

// -------------------------------------------------------

const requestOptions = {
  hostname: config.baseUrl,
  path: `/rest/api/1.0/projects/${config.project}/repos/${
    config.repo
  }/pull-requests`,
  headers: {
    Authorization: `Bearer ${config.token}`
  }
};

https.get(requestOptions, response => {
  if (response.statusCode !== 200) {
    console.error(response.statusMessage);
    return;
  }

  parseResponse(response, jsonResponse => {
    if (!jsonResponse) {
      console.error("bailing out...");
      return;
    }
    const keys = ["id", "state", "open", "closed", "title"];

    const whiteAnsiColor = 37;
    const greenAnsiColor = 42;
    const yellowAnsiColor = 43;

    jsonResponse.values.forEach((pr, index) => {
      const requestOptions = {
        hostname: config.baseUrl,
        path: `/rest/api/1.0/projects/${config.project}/repos/${
          config.repo
        }/pull-requests/${pr.id}`,
        headers: {
          Authorization: `Bearer ${config.token}`
        }
      };

      https.get(requestOptions, response => {
        if (response.statusCode !== 200) {
          console.error(response.statusMessage);
          return;
        }

        parseResponse(response, jsonResponse => {
          const approvers = jsonResponse.reviewers.filter(r => r.approved);
          const approverNames = approvers
            .map(abbreviateReviewerName)
            .map(name => "\x1b[" + greenAnsiColor + ";30m " + name + " \x1b[0m")
            .join(" ");

          const unapprovers = jsonResponse.reviewers.filter(r => !r.approved);
          const unapproverNames = unapprovers
            .map(abbreviateReviewerName)
            .map(
              name => "\x1b[" + yellowAnsiColor + ";30m " + name + " \x1b[0m"
            )
            .join(" ");

          const author = jsonResponse.author.user.displayName;

          console.log(
            `\n[${jsonResponse.id}] ${jsonResponse.title}  [${
              jsonResponse.author.user.name === config.username
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
  });
});
