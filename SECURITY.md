# Security Policy

## Supported versions

The following table describes the versions of this project that are currently supported with security updates:

| Version     | Supported          |
| ----------- | ------------------ |
| 7.x (alpha) | :heavy_check_mark: |
| 6.x         | :heavy_check_mark: |

## Scope

**In scope:** the `@sequelize/*` packages published from this repository — query generation and escaping, model and association behaviour, transactions, pooling, replication, schema operations, and the CLI.

**Out of scope:** your application's own authorization and input validation; database, driver, Node.js and operating-system vulnerabilities; third-party dialects and plugins; and `npm audit` output, which reports a dependency's advisories rather than a Sequelize vulnerability — show us a reachable path through Sequelize instead.

[THREAT_MODEL.md](./THREAT_MODEL.md) has the detailed version, including the trust boundaries and the guarantees Sequelize does and does not make. It models v7 only; v6 has no published threat model, so if you are unsure whether a v6 finding is in scope, ask on the advisory.

If you are unsure which side of the line you are on, treat it as private and report it as a security advisory as described below. Application integration issues and hardening suggestions can be raised as regular GitHub issues.

## Responsible disclosure policy

At Sequelize, we prioritize security issues over our other work. All maintainers work on Sequelize in their spare time, so please read the [disclosure timeline](#disclosure-timeline) before planning a publication date.

If you discover a security vulnerability, please create a security advisory [here](https://github.com/sequelize/sequelize/security/advisories/new).
Otherwise, contact the project maintainers privately. You can find related information in [CONTACT.md](./CONTACT.md).

Sequelize does not operate a bug bounty programme.

Keep the report and everything that demonstrates it private, including proof-of-concept code, regression tests, and exploit details. Do not open a public issue or pull request containing them; attach them to the advisory instead. This applies to anyone acting on your behalf, including automated tools and AI agents.

### How a report progresses

Every report moves through the states below. Maintainers own every transition. We do not offer a guaranteed response time: a report can sit in **Reported** for a while, and the [disclosure timeline](#disclosure-timeline) accounts for that. An advisory that has gone quiet is not a signal in either direction — ask on it and we will tell you which state your report is in.

| State                             | What it means                                                                                                                                            | Leaves this state when                                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Reported**                      | The advisory has been received. No maintainer has assessed it yet.                                                                                       | A maintainer has reproduced the behaviour or established that it does not reproduce, and has recorded the affected versions and the boundary involved. |
| **Assessed**                      | A maintainer has confirmed the behaviour and decided whether Sequelize is responsible for fixing it.                                                     | The outcome is recorded on the advisory: Sequelize will fix it, the report becomes _Not a Sequelize vulnerability_, or it is closed without a fix.     |
| **Fix in progress**               | Sequelize is responsible and a fix is being prepared.                                                                                                    | The fix is merged for every affected supported version, or a maintainer has recorded on the advisory that one will not receive a fix, and why.         |
| **Fixed, pending closeout**       | The fix is merged, but the report is not finished — a release, advisory text, identifier, or reporter credit is still outstanding.                       | Everything under _Closing out a report_ is done.                                                                                                       |
| **Closed**                        | Terminal. The advisory is published or withdrawn and nothing is outstanding.                                                                             | —                                                                                                                                                      |
| **Not a Sequelize vulnerability** | Terminal. The behaviour is out of scope per [THREAT_MODEL.md](./THREAT_MODEL.md), is application misuse, or belongs to another project.                  | —                                                                                                                                                      |
| **Closed without a fix**          | Terminal. A genuine Sequelize vulnerability that will not be fixed — for example when the only fix is a breaking change held for a future major version. | —                                                                                                                                                      |

_Closed without a fix_ still requires a published advisory recording the decision, the reason, and any mitigation available to users, so that people can assess their own exposure.

A report whose fix has been merged is **not** closed. _Fixed, pending closeout_ exists so that finished work is visibly distinct from work nobody has looked at yet, and so that a still-open advisory is never mistaken for an unresolved vulnerability.

#### Closing out a report

Closing a report requires all of:

- a released version containing the fix, for every supported version that was affected, or a note on the advisory explaining why an affected version will not receive one;
- a regression test in the repository covering the fixed behaviour, or a note on the advisory explaining why one does not apply;
- a published GitHub Security Advisory naming the affected versions, the fixed versions, and the impact, or a note on the advisory recording why the finding did not warrant one;
- a CVE identifier where the finding warrants one; maintainers request these through GitHub's Security Advisory system;
- credit to the reporter, unless they asked not to be credited.

Closing a report as _Not a Sequelize vulnerability_ requires a written reason on the advisory, and a link to the upstream issue when the report was routed to another project.

### When you may publish

The confidentiality request above is not open-ended. You are free to publish once any of the following is true:

- the advisory for your report has been published;
- your report was closed without a fix and the advisory recording that decision is public;
- your report was closed as _Not a Sequelize vulnerability_ — findings that only document application misuse or hardening guidance were never restricted;
- six months have passed since your initial report.

### Disclosure timeline

Sequelize is maintained by volunteers in their spare time, so fixes can take a while. We ask reporters to allow up to 6 months from the initial report before disclosing publicly. If a fix is released earlier, we will coordinate disclosure with you at that point.
