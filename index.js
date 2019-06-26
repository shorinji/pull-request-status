const https = require("https");
const config = require("./config");

const white = "97;1m";
const green = "42;30m";
const yellow = "43;30m";

const colorReset = "\x1b[0m";
const color = (str, color) => "\x1b[" + color + str + colorReset;

const authorsToInclude = [];
const authorToHighlight = config.username;

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
    try {
      callback(JSON.parse(body));
    } catch (e) {
      console.error("json parse error: ", e);
      callback();
    }
  });
};

const pathForRepo = repo =>
  `/rest/api/1.0/projects/${repo.project}/repos/${repo.repo}/pull-requests`;

const checkConfig = config => {
  let configOk = true;
  const okKeys = ["username", "token", "serverHostname", "project", "repos"];
  okKeys.forEach(okKey => {
    if (!config[okKey]) {
      configOk = false;
    }
  });
  return configOk;
};

const formatReviewerCount = number => (number < 10 ? " " : "") + `(${number})`;

const getReviewerStatus = (repo, prId, callback) => {
  const requestOptions = {
    hostname: config.serverHostname,
    path: `${pathForRepo(repo)}/${prId}`,
    headers: {
      Authorization: `Bearer ${config.token}`
    }
  };

  https.get(requestOptions, response => {
    if (response.statusCode !== 200) {
      console.error(response.statusMessage);
      callback();
      return;
    }

    parseResponse(response, jsonResponse => {
      if (!jsonResponse) {
        callback();
        return;
      }
      callback(jsonResponse);
    });
  });
};

const printRepoStatus = repo => {
  const indexRequestOptions = {
    hostname: config.serverHostname,
    path: pathForRepo(repo),
    headers: {
      Authorization: `Bearer ${config.token}`
    }
  };

  https.get(indexRequestOptions, response => {
    if (response.statusCode !== 200) {
      console.error(response.statusMessage);
      return;
    }

    parseResponse(response, jsonResponse => {
      if (!jsonResponse) {
        return;
      }

      jsonResponse.values.forEach(pr => {
        if (authorsToInclude.length > 0) {
          if (authorsToInclude.indexOf(pr.author.user.name) === -1) {
            return;
          }
        }

        getReviewerStatus(repo, pr.id, jsonResponse => {
          if (!jsonResponse) {
            return;
          }

          const approvers = jsonResponse.reviewers.filter(r => r.approved);
          const approverNames = approvers
            .map(abbreviateReviewerName)
            .map(name => color(` ${name} `, green))
            .join(" ");

          const unapprovers = jsonResponse.reviewers.filter(r => !r.approved);
          const unapproverNames = unapprovers
            .map(abbreviateReviewerName)
            .map(name => color(` ${name} `, yellow))
            .join(" ");

          const author = jsonResponse.author.user.displayName;

          console.log(
            "\n" +
              color(repo.repo, white) +
              ` [${jsonResponse.id}] ${jsonResponse.title}  [${
                jsonResponse.author.user.name === authorToHighlight
                  ? color(author, white)
                  : author
              }]`
          );
          console.log(
            "UNAPPROVED   %s  %s",
            formatReviewerCount(unapprovers.length),
            unapproverNames
          );
          console.log(
            "APPROVED     %s  %s",
            formatReviewerCount(approvers.length),
            approverNames
          );
          const isReady = approvers.length >= 2;
          console.log(
            color(isReady ? "READY" : "IN PROGRESS", isReady ? green : yellow)
          );
        });
      });
    });
  });
};

// -------------------------------------------------------

if (!checkConfig(config)) {
  console.error("Please fill in config.js");
  process.exit(-1);
}
console.log("config ok");

config.repos.forEach(printRepoStatus);
