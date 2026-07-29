# Sequelize Threat Model

## Document control

| Field    | Value                                                                                                                   |
| -------- | ----------------------------------------------------------------------------------------------------------------------- |
| Target   | Sequelize v7: the `@sequelize/core` ORM, its official `@sequelize/*` dialect packages, and the `@sequelize/cli` package |
| Status   | Living design and triage reference                                                                                      |
| Audience | Maintainers, integrators, security reviewers, and AI agents                                                             |

This document defines security boundaries and expected properties for Sequelize v7: the `@sequelize/core` package, `@sequelize/validator.js`, and the official `@sequelize/*` dialect and CLI packages, published from the `main` branch as v7 alpha releases. This document does not model Sequelize v6; v6 remains within the project's security and disclosure scope under `SECURITY.md`. This is not a vulnerability list, audit report, or assertion that every requirement is currently satisfied. Verify behavior in the applicable code and tests before relying on it. Update this model when supported behavior, trust boundaries, attack methods, security guarantees, or protections change.

## 1. Scope

### In scope

- ORM query construction, value binding, escaping, result mapping, models, associations, scopes, hooks, validation, transactions, pooling, replication, schema operations, and errors.
- All official dialect implementations, whether integrated or separately distributed.
- Official CLI configuration, module loading, migration discovery, execution, and state.
- Sequelize-owned dependency integration, including configuration, data passed to dependencies, and results consumed or exposed by Sequelize.

### Out of scope

- Database, Node.js, driver, TLS, operating-system, and package-manager vulnerabilities unless Sequelize configures or exposes them.
- Application authentication, authorization, tenant policy, rate limiting, secret storage, backup, and database administration.
- Third-party dialects, hooks, model modules, custom validation modules, migrations, and log destinations.
- The internal behavior of third-party dependencies.

Out-of-scope components may still introduce security risks; the applications and operators that use Sequelize are responsible for managing them.

## 2. Security contract

### Trust labels

- **Untrusted:** request data; tenant-controlled values; database rows, metadata, and errors; remote database behavior; and deployer-uncontrolled files.
- **Trusted:** model definitions, query structure, SQL literals, function names, cast types, hooks, dialect classes, model modules, CLI configuration, and migration files.
- **Privileged:** database credentials, connections, driver objects, migration credentials, and code executing in the application or CLI process.

These labels define handling requirements for data and code. They do not by themselves establish which threat actor can control a value in a concrete finding.

### Required invariants

1. Supported data values passed as model attribute values, ordinary `where` values, bind parameters, and replacements must be treated as data, not SQL syntax. Explicit Sequelize SQL-expression objects are SQL structure, even when an API accepts them in a value position.
2. SQL values, identifiers, keywords, types, and raw SQL must use separate handling; never process one as another.
3. Dialects must preserve the same security property even when their SQL syntax and drivers differ.
4. Attacker-controlled input and database output must not modify object prototypes, execute JavaScript, or select local modules.
5. Library-owned processing and state must not allow untrusted input or external behavior to cause unbounded retained resource growth, disproportionate resource amplification across operations, or bypass resource limits that Sequelize documents, exposes, configures, or enforces.
6. Transaction and connection-scoped state must not leak across operations in ways that change later work's intended transactional semantics; failed commit or rollback must not return a connection with an unknown transaction state to the pool.
7. Sequelize must not include bind values in query logs unless `logQueryParameters` is enabled.
8. Sequelize-controlled logs, CLI output, and diagnostic serialization must never expose database connection credentials.
9. Model APIs must not invoke destructive schema operations, migrations, or caller-supplied raw SQL unless the caller explicitly selects an API that performs that action.

### Explicit non-guarantees

Sequelize does **not** provide:

- application or row-level authorization;
- tenant isolation through scopes, schemas, `paranoid`, or read replicas;
- protection when applications pass attacker-controlled raw SQL, table or column names, operators, sort directions, or other SQL syntax without validation;
- automatic field-level write authorization or response redaction;
- automatic limits on resource consumption determined primarily by application-selected workloads or external systems, including database query cost, result volume, association depth, and transaction duration;
- secure credential storage, database TLS policy, or least-privilege database accounts;
- isolation from hooks, dialects, validators, model modules, or migrations loaded into the process.

## 3. Architecture and trust boundaries

```text
 Untrusted request data                         Trusted application code/config
           |                                                |
           v                                                v
  model values / filters ----> ORM API <---- models, scopes, hooks, raw fragments
                                   |
                                   v
                      expression and query builders
                                   |
                                   v
               dialect formatter: bind / escape / quote / raw
                                   |
                                   v
                   read or write connection pool
                                   |
                    TB-1: driver and network boundary
                                   |
                                   v
                              Database
                                   |
                    rows / metadata / errors
                                   v
                       result mapping / model creation
                                   |
                   logs, errors, hooks, application objects

 Trusted CLI config --> module loading --> migration code/raw SQL --> privileged database
                          TB-2                 TB-3
```

TB-4 (logging), TB-5 (replication), and TB-6 (hooks and extensions) are cross-cutting boundaries and do not appear as single points on the flow above.

| Boundary                                                        | Crossing data                                                               | Security responsibility                                                                                                                                                                                                                                                                                                      |
| --------------------------------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TB-1 Application process ↔ database or database-backed storage | Credentials, SQL, bind values, rows, metadata, errors, local database files | Sequelize formats queries and passes configured storage locations to official dialects; the dialect driver implements the protocol and TLS where applicable; the deployer authenticates and authorizes connections and protects local storage ownership, permissions, path integrity, auxiliary files, and same-host access. |
| TB-2 Filesystem/package graph → process                         | Dialect, model, config, hook, validator, and migration modules              | Imported modules execute with process authority and must be trusted.                                                                                                                                                                                                                                                         |
| TB-3 CLI → database administration                              | Arbitrary migration code/SQL and schema credentials                         | The deployer reviews migrations and separates DDL credentials from runtime credentials.                                                                                                                                                                                                                                      |
| TB-4 ORM → logging/diagnostics                                  | SQL, timings, labels, parameters, errors                                    | Sequelize controls ORM logs, CLI output, and diagnostic serialization it emits. Applications and operators control downstream log sinks, traces, and public error responses.                                                                                                                                                 |
| TB-5 Write primary → read replicas                              | Replicated rows and lag                                                     | The application must not assume a replica reflects a recent security-relevant write.                                                                                                                                                                                                                                         |
| TB-6 Caller → hooks/extensions                                  | Mutable options, model values, results, credentials, connections            | Hooks and extensions are fully trusted code, not sandboxed plugins.                                                                                                                                                                                                                                                          |

## 4. Assets and actors

### Assets

- Confidential database rows, credentials, SQL parameters, schema metadata, and error details.
- Integrity of records, tenant filters, associations, migrations, and transactions.
- Availability of the Node.js process, event loop, memory, connection pools, and database.
- Integrity of generated SQL across all supported dialects.
- Developer and CI workstations that run the CLI, configuration, and migration modules.

### Actors

| Actor                                | Trust level | Baseline capabilities                                                                                                                                             |
| ------------------------------------ | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote application user              | Untrusted   | Controls values and may control which filters, sort fields, associations, functions, or other query parts the application exposes.                                |
| Tenant user                          | Untrusted   | Controls inputs and operations available within that tenant's scope and may attempt to bypass tenant, soft-delete, ownership, or replica-consistency constraints. |
| Database administrator               | Privileged  | Controls database schema, stored procedures, views, triggers, aliases, metadata exposure, and database-side behavior visible through normal queries.              |
| Application developer                | Trusted     | Controls query structure, model definitions, field allowlists, hooks, and transaction usage.                                                                      |
| Extension or supply-chain maintainer | Privileged  | Controls a dialect, driver, hook, validator, model module, migration, config module, or dependency.                                                               |
| Operator or CI user                  | Privileged  | Controls credentials, connection options, migration directories, environment, logs, and deployment commands.                                                      |

Use this table to identify the relevant threat actor for the finding and the capabilities available to that threat actor by default. If the exploit path requires the threat actor to exercise a capability that Section 4 assigns to another actor, the finding's attacker model is wrong unless the report also shows how that capability is realistically exposed to the threat actor. If the bug does not let the threat actor achieve an outcome beyond what that actor could already achieve without the bug, that is a strong invalidation signal.

A trusted or privileged actor is not the threat actor merely because it performs an expected action or supplies a supported configuration, schema, query shape, or deployment state that makes the code path reachable. In those cases, treat that actor's behavior as a precondition and evaluate the lower-trust actor who exploits the resulting library behavior.

If the threat actor itself is trusted or privileged and exploitation requires malicious action or compromise of that role, the path begins only after loss of a protected trust domain. Such findings cannot exceed Low severity, and they should be invalidated entirely when the bug does not let that actor achieve an outcome beyond its baseline capabilities.

## 5. Entry-point rules

| Input or API                                                                   | Classification                           | Rule                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------ | ---------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Untrusted application input model                                              | Plain data only                          | Treat JSON-like plain objects, arrays, primitives, buffers, and dates as supported untrusted input. Objects with getters, setters, Proxies, custom coercion, thenables, or other executable behavior are application-controlled code and must not be treated as ordinary untrusted data. |
| Supported data values in model attributes and ordinary `where` value positions | Untrusted values                         | Pass them to Sequelize without combining them into SQL text. Validate their business meaning separately.                                                                                                                                                                                 |
| Bind parameters                                                                | Untrusted values                         | Prefer when supported. Missing binds must fail before execution.                                                                                                                                                                                                                         |
| Replacements                                                                   | Untrusted values                         | Sequelize escapes and inserts them as values. Place markers only where SQL permits a value, never inside strings, identifiers, comments, or dollar-quoted bodies.                                                                                                                        |
| `sql` template interpolation                                                   | Mixed                                    | Sequelize handles plain interpolated values as data. The application remains responsible for the template text and any explicitly raw SQL.                                                                                                                                               |
| Explicit Sequelize SQL-expression objects                                      | Mixed SQL structure                      | The outer expression remains SQL structure even when accepted in a value position. Classify each nested argument separately; do not treat the outer object as an untrusted value.                                                                                                        |
| `literal`, raw query text, custom `ON`, raw fragments                          | Trusted SQL                              | Never build them from request data. Use bind parameters for values whenever the API supports them.                                                                                                                                                                                       |
| Function name, cast type, operator, ordering direction, hint                   | Application-controlled SQL option        | Select from an application allowlist. Escaping a token does not authorize its use.                                                                                                                                                                                                       |
| Table, schema, column, and alias                                               | Authorized identifier                    | Use identifier APIs and allow only objects the caller may access.                                                                                                                                                                                                                        |
| Attribute paths and nested JSON syntax                                         | Allowlisted untrusted input              | Allow only known attributes and limit path length and the number of paths. Parsing a path does not authorize it.                                                                                                                                                                         |
| Create/update object and `fields`                                              | Untrusted data plus authorized field set | Copy direct properties into a plain object and use a server-defined field allowlist.                                                                                                                                                                                                     |
| `attributes`, `include`, scopes, `paranoid`, `withoutScope`                    | Application-controlled options           | Construct server-side. They can expose hidden columns, associations, tenants, or soft-deleted rows.                                                                                                                                                                                      |
| Connection options and hooks                                                   | Sensitive configuration                  | Protect from request data; hooks can observe or change credentials and connections.                                                                                                                                                                                                      |
| Database rows, aliases, metadata, and errors                                   | Untrusted database output                | Handle them defensively during parsing, nesting, model creation, serialization, and logging. A finding must still establish which threat actor can influence the specific output.                                                                                                        |
| CLI config, dialect path, migration folder/files                               | Code with CLI access                     | Load only from a reviewed project whose files and dependencies are access-controlled.                                                                                                                                                                                                    |

### Disposition and severity methodology

Assign a disposition, then a severity. Record enough evidence for another reviewer to reproduce or challenge the result. Base the conclusion on the evidence available for the finding. The conclusion must be final for that evidence: do not defer it to another pass or qualify it with hypothetical future evidence, inputs, deployments, or exploit paths.

#### Disposition

Before assigning disposition, evaluate the complete exploit path under a compliant application and operator:

1. Identify the relevant threat actor and its baseline capabilities from Section 4.
2. Identify every additional capability required before the defect is reached and which actor Section 4 assigns it to.
3. Ask whether the exploit still succeeds when those capability boundaries and obligations are respected.
4. Identify the outcome the bug lets the threat actor achieve beyond what that actor could already achieve without the bug.

Then apply the disposition rules:

- **Library responsibility** — a required Sequelize guarantee or invariant failed under intended use, and the concrete impact does not require an additional application or operator failure.
- **Shared responsibility** — Sequelize introduces an independent unsafe behavior, but exploitation also requires an application or operator failure.
- **Application misuse / defense-in-depth** — Sequelize preserves its invariants and introduces no independent unsafe behavior, but the issue exists only because the application or operator exposes an input or capability it is required to control.
- **Out of scope / dependency issue** — the failure is wholly inside an out-of-scope database, driver, runtime, operating system, or third-party component and Sequelize neither configures nor exposes it. Route it to the responsible project without assigning Sequelize vulnerability severity.

#### Severity

Rate three factors, combine them into a starting severity, then apply the disposition rules and finding-specific adjustments.

- **Impact if triggered.** Data exposure, integrity corruption, or code execution is high impact. Availability impact is high when an attacker can repeatedly or persistently disable a process or database for many users, and medium when disruption is bounded, narrow, or readily recoverable.
- **Blast radius.** Whole-process effects are wide. Effects limited to one query, request, or connection are narrow.
- **Reachability.** Evaluate from the relevant threat actor and its baseline capabilities to the final impact. Paths available through that actor's documented inputs are easier to reach; paths that require another actor's capability, application misuse, operator error, unusual deployment assumptions, or a separate bug are harder.

Severity must be derived from the complete attack path, not from maximum impact alone. Record every non-library precondition required before the defect can be exploited and explain how each affects reachability. The existence of a public API, supported option, or severe end impact does not by itself determine reachability or severity.

Impact should be measured relative to what the threat actor could already achieve without the bug. If the bug does not let the threat actor achieve an outcome beyond that, that is a strong invalidation signal.

Combine all three factors into a starting severity. No single factor may substitute for the others:

- **Critical** — exceptional impact with broad practical exposure across many consumers or deployments.
- **High** — high impact with broad practical exposure after accounting for blast radius and required preconditions.
- **Medium** — material impact with bounded practical exposure, or high impact whose exploit path depends on meaningful preconditions.
- **Low** — limited impact or exploit paths with narrow effects and substantial preconditions.
- **Informational** — useful hardening or integration guidance that does not establish a Sequelize vulnerability.

Apply these adjustments, and record the reason for any change:

- **Application misuse / defense-in-depth** and **out of scope / dependency issue** dispositions do not receive Sequelize vulnerability severity. They may be recorded as **Informational** when useful for hardening or integration guidance, or tracked as external-project issues where appropriate.
- For **Shared responsibility** findings, rate the complete attack path and treat application or operator failure as a reachability precondition; do not count the same precondition again as an automatic severity reduction.
- If the threat actor itself is trusted or privileged and the exploit requires malicious action or compromise of that role, cap severity at Low. Do not apply this cap when the trusted or privileged actor only performs a legitimate expected action and a lower-trust actor exploits the resulting behavior.
- Raise or lower the starting severity once the concrete finding's preconditions, affected versions, deployment, database privileges, duration, and recoverability are known, and record the reason.

The entry-point rules establish expected handling only. Final disposition and severity come from the concrete exploit path and the factors above.

## 6. Threat scenarios

These are plausible threat scenarios, not confirmed vulnerabilities, and they are not an exhaustive list of security-relevant effects. Assign severity and remediation priority when evaluating a concrete finding with known attacker preconditions, affected deployments, database privileges, scope, and impact.

| ID      | Actor(s)                                                                              | Surface / boundary                                                                                              | Scenario and impact                                                                                                                                                                                                                                                                                                   | Primary controls and ownership                                                                                                                                                                                                                                                                       |
| ------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QRY-01  | Remote application user; Application developer                                        | ORM API → expression and query builders → dialect formatter → TB-1                                              | Request data becomes raw SQL, a table or column name, an operator, a sort direction, or another SQL instruction, enabling reads or writes allowed to the database account.                                                                                                                                            | Library: APIs that keep data separate from SQL, strict validation, and the same security tests for every dialect. Application: allowlists for every SQL option and no attacker-controlled literals.                                                                                                  |
| QRY-02  | Remote application user; Application developer                                        | Raw query and `sql` interpolation → dialect formatter → TB-1                                                    | A replacement or interpolation inside a string, identifier, comment, or dollar-quoted body is substituted incorrectly and changes the SQL meaning.                                                                                                                                                                    | Library: reject invalid marker positions. Application: use parameters only where SQL permits values.                                                                                                                                                                                                 |
| QRY-03  | Remote application user                                                               | Dialect formatter → driver and network (TB-1)                                                                   | A dialect quotes, parses, or binds input differently and interprets data as executable SQL or multiple statements.                                                                                                                                                                                                    | Library: run shared malicious-input tests and real-server tests for every dialect, including connection setup statements.                                                                                                                                                                            |
| AUTH-01 | Tenant user; Application developer                                                    | ORM API, scopes, associations, and `paranoid` filtering                                                         | An attacker controls query parts, or the application removes or replaces a tenant, owner, scope, association, or `paranoid` condition.                                                                                                                                                                                | Application: build authorization conditions independently; scopes and soft deletion do not enforce authorization.                                                                                                                                                                                    |
| AUTH-02 | Tenant user; Application developer                                                    | Model create/update APIs and model value mapping                                                                | An untrusted create or update object writes protected or inherited fields such as role, owner, tenant, or deletion state.                                                                                                                                                                                             | Application: allowlist writable `fields`. Library: ignore inherited properties and reject unknown query keys where possible.                                                                                                                                                                         |
| OUT-01  | Remote application user; Tenant user; Database administrator                          | Driver and network (TB-1) → result mapping and model creation                                                   | An attacker controls result identifiers that Sequelize interprets as object structure, causing returned data to alter prototypes, inherited behavior, or state outside the result. Application query construction or database schema that only makes this behavior reachable is a precondition, not the threat actor. | Library: treat result identifiers solely as data during result mapping and prevent them from changing object prototypes or inherited behavior.                                                                                                                                                       |
| OUT-02  | Database administrator                                                                | Driver and network (TB-1) → dialect-owned parsing, result mapping, and model creation                           | Crafted database output causes excessive decoding work, incorrect types, or unsafe property access during Sequelize-owned parsing and result mapping.                                                                                                                                                                 | Library: never evaluate row data as code and fuzz dialect-owned parsers and result mapping with malformed and unusual data. Dependency maintainer: ensure native driver safety; driver vulnerabilities remain out of scope unless Sequelize configures or exposes them.                              |
| DOS-01  | Remote application user; Tenant user                                                  | ORM API → attribute/JSON path parsing and expression builders                                                   | Unique attribute/JSON paths, deeply nested filters, large `IN` lists, or complex expressions consume unbounded parser cache, CPU, SQL size, or memory.                                                                                                                                                                | Library: bound Sequelize-owned parser depth, key count, and cache size and reject unknown attributes before expensive processing. Application: bound user-controlled input length, depth, and key count.                                                                                             |
| DOS-02  | Remote application user; Application developer                                        | ORM API → association query building → TB-1 → result mapping                                                    | Unbounded results or joins across multiple associations multiply rows during transfer and duplicate removal.                                                                                                                                                                                                          | Application: paginate, limit result volume and association depth, and compare total query cost before using `separate`.                                                                                                                                                                              |
| DOS-03  | Remote application user; Database administrator                                       | ORM API → connection pool → driver and network (TB-1)                                                           | Slow queries, retries, unmanaged or long transactions, or many Sequelize instances consume every available database connection.                                                                                                                                                                                       | Application: limit retries, use managed transactions, and constrain transaction duration. Operator: configure supported connection-acquisition, statement, lock, and transaction timeouts and monitor the pool.                                                                                      |
| TXN-01  | Remote application user; Application developer                                        | Managed transaction context, nested transaction handling, connection-scoped transaction state, and hooks (TB-6) | A query runs outside the intended transaction, nested transactions behave differently than expected, connection-scoped state leaks across operations and changes later isolation or transactional semantics, or a hook's external effect remains after rollback.                                                      | Library: preserve documented transaction-context and nesting semantics and restore or discard connection-scoped transaction state before pool reuse. Application: use managed transactions, test transaction context, and perform external effects after commit or make repeated execution harmless. |
| TXN-02  | Database administrator                                                                | Transaction manager → connection pool → driver and network (TB-1)                                               | Commit or rollback fails and a connection with an unknown transaction state is reused.                                                                                                                                                                                                                                | Library: destroy the connection and test this failure path for every driver.                                                                                                                                                                                                                         |
| REP-01  | Tenant user                                                                           | Write pool → read replicas (TB-5)                                                                               | A security decision reads stale replica state after a password, role, revocation, ownership, or policy write.                                                                                                                                                                                                         | Application: read data used for authorization from the primary database. A transaction guarantees primary routing only when it uses a write connection; read-only transactions may use the read pool. The application decides when fresh data is required.                                           |
| INFO-01 | Remote application user; Database administrator; Extension or supply-chain maintainer | Driver and network (TB-1), logging (TB-4), and hooks (TB-6)                                                     | SQL, bind values, credentials, personal data, or database errors reach logs, traces, user responses, or hooks.                                                                                                                                                                                                        | Library: emit only configured query data and preserve logging controls. Application and Operator: redact every error, log, and trace destination.                                                                                                                                                    |
| CONN-01 | Remote application user; Operator or CI user                                          | Connection configuration → driver and network (TB-1)                                                            | Attacker-controlled connection options redirect the ORM, weaken TLS, inject connection setup SQL, or select an account with excessive privileges.                                                                                                                                                                     | Library: validate Sequelize-owned connection options and safely generate connection setup SQL. Operator: restrict connection configuration, allow only documented option values, require authenticated TLS, and use least-privilege accounts.                                                        |
| EXT-01  | Extension or supply-chain maintainer; Operator or CI user                             | Filesystem/package graph (TB-2) and hooks/extensions (TB-6)                                                     | A malicious dialect, hook, validator, discovered model, CLI config, or migration executes with process or CI authority.                                                                                                                                                                                               | Application and Operator: pin and review packages, protect the filesystem, and treat extensions as unsandboxed code.                                                                                                                                                                                 |
| MIG-01  | Extension or supply-chain maintainer; Operator or CI user                             | Filesystem/package graph (TB-2) → CLI and database administration (TB-3)                                        | The CLI executes modified JavaScript or arbitrary SQL using credentials that can change the schema; rollback may be unavailable, incomplete, or destructive.                                                                                                                                                          | Application: review migrations. Operator: integrity-protect migrations, use deployment-only schema credentials, test recovery, and do not assume migrations are transactional.                                                                                                                       |
| DEST-01 | Remote application user; Application developer; Operator or CI user                   | ORM destructive APIs and CLI/database administration (TB-3)                                                     | `sync({ force: true })`, `sync({ alter: true })`, `drop`, `truncate`, broad `destroy` or `update`, or migration undo destroys unintended data.                                                                                                                                                                        | Library: keep destructive APIs separate and require explicit `where` where relevant. Application and Operator: add environment checks, use least privilege and backups, and prohibit destructive `sync` modes in production.                                                                         |
| TYPE-01 | Tenant user; Application developer; Database administrator                            | Dialect formatter → driver/database (TB-1) → result mapping                                                     | Dialect differences in NULL, text comparison, time zones, precision, type conversion, JSON, ranges, or large numbers change an authorization or data-integrity decision.                                                                                                                                              | Library: test boundary conversions across official dialects. Application: define exact rules and enforce critical invariants with database constraints.                                                                                                                                              |
| SUP-01  | Extension or supply-chain maintainer                                                  | Filesystem/package graph (TB-2), driver and network (TB-1)                                                      | A compromised driver or dependency reads credentials or data, or runs code during install, import, or runtime.                                                                                                                                                                                                        | Library: review direct dependencies, verify their origin and integrity, and minimize optional and native components. Operator: pin verified releases and coordinate security updates.                                                                                                                |

## 7. Required control patterns

Implementations must preserve these properties. Verify behavior with tests; file names and internal design do not prove compliance.
The table states required behavior, not confirmed implementation status.

| Control                         | Requirement                                                                                                                                                                                                                                   | Limitation                                                                                                                          |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Values remain data              | Sequelize validates types and binds or escapes supported data values used in model attributes, ordinary `where` value positions, bind parameters, and replacements. Explicit SQL-expression objects are formatted as SQL structure by design. | Binding or escaping values does not make attacker-controlled raw SQL or structural expression components safe.                      |
| Context-aware parameter parsing | Bind and replacement parsing handles strings, identifiers, comments, escape characters, and dialect-specific quoting.                                                                                                                         | The application must still provide the surrounding raw SQL, and grammar differs by dialect.                                         |
| Complete parameters             | Missing bind and replacement values fail before query execution.                                                                                                                                                                              | Providing every parameter does not make the surrounding SQL trustworthy.                                                            |
| Identifier separation           | Identifiers use a representation and quoting path distinct from values and raw SQL.                                                                                                                                                           | Quoting prevents syntax injection, not unauthorized table or column selection.                                                      |
| Logging minimization            | Sequelize does not emit query logs unless application logging or debug output is enabled. Logged SQL may contain replacement values and SQL literals; `logQueryParameters` additionally appends separately bound values.                      | Logs, database error objects, and driver diagnostics can expose SQL, values, or secrets and require destination-specific redaction. |
| Managed transactions            | Managed transactions commit or roll back automatically and apply the transaction to nested queries where supported.                                                                                                                           | Unmanaged transactions, explicit overrides, and effects outside the database bypass this guarantee.                                 |
| Failed transaction cleanup      | A connection with an unknown transaction state is destroyed instead of returned to the pool.                                                                                                                                                  | A driver failure can still leave the application unsure whether the database committed.                                             |
| Replication routing             | Writes and non-read-only transactions use the write pool; reads and read-only transactions may use the read pool; read and write pools remain separate when replication is configured.                                                        | Replicas may be stale or compromised outside Sequelize's control.                                                                   |
| Bulk-operation safeguards       | Bulk deletes and updates require an explicit condition or a separately named operation for the entire table.                                                                                                                                  | Conditions that match every row remain valid; schema and whole-table APIs intentionally destroy data.                               |
| Model validation                | Model validation runs before database writes when the API says validation applies.                                                                                                                                                            | Validation is not authorization, may be disabled, and raw queries bypass it; database constraints remain required.                  |
| CLI input validation            | The CLI validates configuration and required migration exports before use.                                                                                                                                                                    | Configuration, imported modules, and SQL files execute as trusted code with the CLI's access.                                       |

## 8. Required verification

Apply every relevant check to changes that affect SQL generation, database results, transactions, connections, logging, extensions, or migrations. Use real drivers and servers when their parsing affects the result.

1. **SQL-part tests:** test values, identifiers, keywords, types, function names, paths, raw fragments, comments, quotes, backslashes, semicolons, Unicode, and zero bytes.
2. **Dialect consistency:** run the same security tests for all official dialects and use real servers where protocol, encoding, multiple statements, or connection setup matters.
3. **Property tests:** generated SQL structure must not change when only an untrusted value changes.
4. **Mutation tests:** deliberately break escaping, binding, direct-property checks, and transaction cleanup; confirm that the relevant tests fail.
5. **Result tests:** crafted column names and nested aliases, duplicate names, huge rows, invalid types, and database errors must not modify prototypes or expose unintended objects.
6. **Resource tests:** define and test explicit memory and time bounds for Sequelize-owned parsers, caches, retries, and pool operations; for database-side work, test configured timeout, cancellation, and cleanup behavior.
7. **Transaction tests:** test commit, rollback, nested modes, automatically supplied transaction context, cancellation, driver failure, and hook failure.
8. **CLI tests:** test configuration and migration path selection, invalid configuration, dialect selection, raw and JavaScript migrations, partial failure, concurrent execution, and recovery.
9. **Disclosure tests:** ensure Sequelize emits no query logs without application logging or debug output; when logging is enabled, ensure separately bound values are appended only when `logQueryParameters` is enabled; treat replacement values and literals as part of logged SQL; ensure Sequelize-controlled logs, CLI output, and diagnostic serialization do not expose credentials; verify that error objects retain only the sensitive fields required by their documented API.

## 9. Integration requirements

Applications using Sequelize securely must:

- map request inputs into server-owned query templates and field/identifier allowlists;
- enforce authorization independently of scopes, `paranoid`, associations, and model validation;
- paginate and limit query complexity, association depth, result volume, transaction duration, and concurrency;
- use managed transactions and primary reads for security-sensitive read-after-write decisions;
- configure authenticated database transport, separate runtime and migration accounts, and least database privileges;
- keep query and parameter logging disabled unless every destination performs tested redaction;
- serialize ORM/database errors through a fixed public error schema;
- review every hook, dialect, validator, model module, CLI config, and migration as privileged code;
- prohibit production `sync({ force: true })` and `sync({ alter: true })`.

## 10. Agent review procedure

For any report or code change:

1. Identify the relevant threat actor from Section 4, then identify the actor-controlled source and classify it using Section 5.
2. Trace the complete lifecycle and record every transformation, resource allocation, retained state, cleanup path, and cross-operation effect.
3. Check all official dialect overrides; do not generalize from one dialect.
4. State the threat actor, baseline capabilities, required additional capabilities and the actors Section 4 assigns them to, failed guarantee or applicable non-guarantee, disposition, concrete impact, blast radius, reachability, required non-library preconditions, whether the exploit survives compliant integration, outcome gained beyond what the threat actor could already achieve without the bug, database privileges, final severity or Informational label, and the reason for any adjustment.
5. For resource findings, distinguish request-scoped work caused by application-selected input from retained state or cross-operation amplification introduced by Sequelize. Absence of an existing or documented resource control is not a dismissal criterion.
6. Evaluate every affected input path and trust boundary. Do not stop after identifying either an application- or operator-controlled input or a Sequelize failure; determine which failures are required for the concrete impact.
7. Distinguish application misuse from a library failure by applying the disposition check in Section 5. Supported data values in model attributes, ordinary `where` value positions, bind parameters, and replacements must remain data; explicit SQL-expression objects are a separate structural input class, and the existence of raw SQL APIs does not weaken the value guarantee.
8. Follow [SECURITY.md](SECURITY.md). Search open GitHub issues and pull requests, the project's known-findings file when present, and any approved private advisory tracker before treating a finding as new. Do not disclose private records in public artifacts.
9. Require a failing regression test and, where applicable, a real-database reproduction before closure.

## 11. Primary references

- [Sequelize v7 documentation](https://sequelize.org/docs/v7/)
- [Sequelize monorepo — `@sequelize/core`, official dialects, and `@sequelize/cli`](https://github.com/sequelize/sequelize)
- [`@sequelize/cli` package source](https://github.com/sequelize/sequelize/tree/main/packages/cli)
