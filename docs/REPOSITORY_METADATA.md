# Repository discovery metadata

The canonical product name is **Claude Code Canary**. Keep the existing GitHub repository path `spk-c/claude-cody-canary` for existing references and Actions consumers. The package name remains `claude-code-canary`.

## Recommended GitHub About fields

- **Description:** Regression and compatibility testing for Claude Code, plugins and MCP servers. Detect breaking changes, automate CI checks and capture reproducible evidence.
- **Website:** https://github.com/spk-c/claude-cody-canary/releases
- **Topics:** `claude-code`, `claude-code-canary`, `mcp`, `model-context-protocol`, `regression-testing`, `compatibility-testing`, `github-actions`, `typescript`, `cli`, `release-monitoring`, `plugin-testing`, `ai-agents`, `continuous-integration`, `security-testing`.

These match the implemented project focus. GitHub About fields are repository settings, **not** README content or package metadata: they are only applied after a GitHub repository settings change has been confirmed.

## Apply in the GitHub website

Open https://github.com/spk-c/claude-cody-canary and use the **About** section's edit control. Set the description, website and Topics above and save. Leave the repository name unchanged.

Alternatively, on a **GitHub-authenticated machine** with a suitably privileged GitHub CLI:

~~~sh
gh repo edit spk-c/claude-cody-canary \
  --description "Regression and compatibility testing for Claude Code, plugins and MCP servers. Detect breaking changes, automate CI checks and capture reproducible evidence." \
  --homepage "https://github.com/spk-c/claude-cody-canary/releases" \
  --add-topic claude-code,claude-code-canary,mcp,model-context-protocol,regression-testing,compatibility-testing,github-actions,typescript,cli,release-monitoring,plugin-testing,ai-agents,continuous-integration,security-testing
~~~

Verify the final public values:

~~~sh
gh repo view spk-c/claude-cody-canary --json name,description,homepageUrl,repositoryTopics
~~~

This command is **only documentation**. Changes to this file do not alter the GitHub About fields. Do not paste personal GitHub tokens into issues or commits.
