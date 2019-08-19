---
name: Bug report
about: Create a bug report to help us improve
title: ''
labels: 'type: bug'
assignees: ''

---

<!--
If you don't follow the issue template, your issue may be closed.
Please note this is an issue tracker, not a support forum.
For general questions, please use StackOverflow or Slack.
-->

## Issue Description

### What are you doing?

<!--
Post a MINIMAL, SELF-CONTAINED code that reproduces the issue. It must be runnable by simply copying and pasting into an isolated JS file, except possibly for the database connection configuration.
Check http://sscce.org/ or https://stackoverflow.com/help/minimal-reproducible-example to learn more about SSCCE/MCVE/reprex.
-->

```js
// MINIMAL, SELF-CONTAINED code here (SSCCE/MCVE/reprex)
```

### What do you expect to happen?

<!-- Explain what behavior you wanted/expected. You may include an output. -->

_I wanted Foo!_

### What is actually happening?

<!-- Show what happened. -->

_The output was Bar!_

```
Output here
```

### Additional context
Add any other context or screenshots about the feature request here.

### Environment

- Sequelize version: XXX <!-- run `npm list sequelize` to obtain this -->
- Node.js version: XXX <!-- run `node -v` to obtain this -->
- Operating System: XXX
- If TypeScript related: TypeScript version: XXX

## Issue Template Checklist

<!-- Please answer the questions below. If you don't, your issue may be closed. -->

### How does this problem relate to dialects?

<!-- Choose one. -->

- [ ] I think this problem happens regardless of the dialect.
- [ ] I think this problem happens only for the following dialect(s): <!-- Put dialect(s) here -->
- [ ] I don't know, I was using PUT-YOUR-DIALECT-HERE, with connector library version XXX and database version XXX

### Would you be willing to resolve this issue by subitting a Pull Request?

<!-- Remember that first contributors are welcome! -->

- [ ] Yes, I have the time and I know how to start.
- [ ] Yes, I have the time but I don't know how to start, I would need guidance.
- [ ] No, I don't have the time, although I believe I could do it if I had the time...
- [ ] No, I don't have the time and I wouldn't even know how to start.

### SSCCE declaration

- [ ] The code I posted above is a true [SSCCE](http://sscce.org/) (also known as [MCVE/reprex](https://stackoverflow.com/help/minimal-reproducible-example)). It is runnable by simply copying and pasting into an isolated JS file, except possibly for the database connection configuration.
