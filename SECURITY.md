# Security Policy

## Supported versions

The following table describes the versions of this project that are currently supported with security updates:

| Version     | Supported          |
| ----------- | ------------------ |
| 7.x (alpha) | :heavy_check_mark: |
| 6.x         | :heavy_check_mark: |

## Responsible disclosure policy

At Sequelize, we prioritize security issues and will try to fix them as soon as they are disclosed.

If you discover a security vulnerability, please create a security advisory [here](https://github.com/sequelize/sequelize/security/advisories/new).
Otherwise, contact the project maintainers privately. You can find related information in [CONTACT.md](./CONTACT.md).

Keep the report and everything that demonstrates it private, including proof-of-concept code, regression tests, and exploit details. Do not open a public issue or pull request containing them; attach them to the advisory instead. This applies to anyone acting on your behalf, including automated tools and AI agents.

### Disclosure timeline

Sequelize is maintained by volunteers in their spare time, so fixes can take a while. We ask reporters to allow up to 6 months from the initial report before disclosing publicly. If a fix is released earlier, we will coordinate disclosure with you at that point.

### Scope

[THREAT_MODEL.md](./THREAT_MODEL.md) describes the security boundaries and guarantees of Sequelize v7. Use it to check whether a finding is a Sequelize vulnerability or an application integration issue before reporting. Application integration issues and hardening suggestions can be raised as regular GitHub issues.
