# Optimistic Locking

Sequelize has built-in support for optimistic locking through a model instance version count.

Optimistic locking is disabled by default and can be enabled by setting the `version` property to true in a specific model definition or global model configuration. See [model configuration](models-definition.html#configuration) for more details.

Optimistic locking allows concurrent access to model records for edits and prevents conflicts from overwriting data.  It does this by checking whether another process has made changes to a record since it was read and throws an OptimisticLockError when a conflict is detected.