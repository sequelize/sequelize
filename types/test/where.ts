import { AndOperator, fn, Model, Op, OrOperator, Sequelize, WhereOperators, WhereOptions } from 'sequelize';
import Transaction from '../lib/transaction';

class MyModel extends Model {
    public hi: number;
}

let where: WhereOptions;

// From http://docs.sequelizejs.com/en/v4/docs/querying/

// Operators

const and: AndOperator = {
    [Op.and]: { a: 5 }, // AND (a = 5)
};

const or: OrOperator = {
    [Op.or]: [{ a: 5 }, { a: 6 }], // (a = 5 OR a = 6)
};

let operators: WhereOperators = {
    [Op.gt]: 6, // > 6
    [Op.gte]: 6, // >= 6
    [Op.lt]: 10, // < 10
    [Op.lte]: 10, // <= 10
    [Op.ne]: 20, // != 20
    [Op.not]: true, // IS NOT TRUE
    [Op.between]: [6, 10], // BETWEEN 6 AND 10
    [Op.notBetween]: [11, 15], // NOT BETWEEN 11 AND 15
    [Op.in]: [1, 2], // IN [1, 2]
    [Op.notIn]: [1, 2], // NOT IN [1, 2]
    [Op.like]: '%hat', // LIKE '%hat'
    [Op.notLike]: '%hat', // NOT LIKE '%hat'
    [Op.iLike]: '%hat', // ILIKE '%hat' (case insensitive) (PG only)
    [Op.notILike]: '%hat', // NOT ILIKE '%hat'  (PG only)
    [Op.startsWith]: 'hat',
    [Op.endsWith]: 'hat',
    [Op.substring]: 'hat',
    [Op.overlap]: [1, 2], // && [1, 2] (PG array overlap operator)
    [Op.contains]: [1, 2], // @> [1, 2] (PG array contains operator)
    [Op.contained]: [1, 2], // <@ [1, 2] (PG array contained by operator)
    [Op.any]: [2, 3], // ANY ARRAY[2, 3]::INTEGER (PG only)
};

operators = {
    [Op.like]: { [Op.any]: ['cat', 'hat'] }, // LIKE ANY ARRAY['cat', 'hat'] - also works for iLike and notLike
};

// Combinations

MyModel.findOne({ where: or });
MyModel.findOne({ where: and });

where = Sequelize.and();

where = Sequelize.or();

where = { [Op.and]: [] };

where = {
    rank: Sequelize.and({ [Op.lt]: 1000 }, { [Op.eq]: null }),
};

where = {
    rank: Sequelize.or({ [Op.lt]: 1000 }, { [Op.eq]: null }),
};

where = {
    rank: {
        [Op.or]: {
            [Op.lt]: 1000,
            [Op.eq]: null,
        },
    },
};
// rank < 1000 OR rank IS NULL

where = {
    createdAt: {
        [Op.lt]: new Date(),
        [Op.gt]: new Date(Date.now() - 24 * 60 * 60 * 1000),
    },
};
// createdAt < [timestamp] AND createdAt > [timestamp]

where = {
    [Op.or]: [
        {
            title: {
                [Op.like]: 'Boat%',
            },
        },
        {
            description: {
                [Op.like]: '%boat%',
            },
        },
    ],
};
// title LIKE 'Boat%' OR description LIKE '%boat%'

// Containment

where = {
    meta: {
        [Op.contains]: {
            site: {
                url: 'http://google.com',
            },
        },
    },
};

// Relations / Associations
// Find all projects with a least one task where task.state === project.task
MyModel.findAll({
    include: [
        {
            model: MyModel,
            where: { state: Sequelize.col('project.state') },
        },
    ],
});

MyModel.findOne({
    include: [
        {
            include: [{ model: MyModel, where }],
            model: MyModel,
            where,
        },
    ],
    where,
});
MyModel.destroy({ where });
MyModel.update({ hi: 1 }, { where });

// From http://docs.sequelizejs.com/en/v4/docs/models-usage/

// find multiple entries
MyModel.findAll().then(projects => {
    // projects will be an array of all MyModel instances
});

// search for specific attributes - hash usage
MyModel.findAll({ where: { name: 'A MyModel', enabled: true } }).then(projects => {
    // projects will be an array of MyModel instances with the specified name
});

// search within a specific range
MyModel.findAll({ where: { id: [1, 2, 3] } }).then(projects => {
    // projects will be an array of MyModels having the id 1, 2 or 3
    // this is actually doing an IN query
});

// locks
MyModel.findAll({ lock: Transaction.LOCK.KEY_SHARE }).then(projects => {
    // noop
});

// locks on model
MyModel.findAll({ lock: { level: Transaction.LOCK.KEY_SHARE, of: MyModel} }).then(projects => {
    // noop
});

MyModel.findAll({
    where: {
        // tslint:disable-next-line:no-object-literal-type-assertion
        id: {
            // casting here to check a missing operator is not accepted as field name
            [Op.and]: { a: 5 }, // AND (a = 5)
            [Op.or]: [{ a: 5 }, { a: 6 }], // (a = 5 OR a = 6)
            [Op.gt]: 6, // id > 6
            [Op.gte]: 6, // id >= 6
            [Op.lt]: 10, // id < 10
            [Op.lte]: 10, // id <= 10
            [Op.ne]: 20, // id != 20
            [Op.between]: [6, 10], // BETWEEN 6 AND 10
            [Op.notBetween]: [11, 15], // NOT BETWEEN 11 AND 15
            [Op.in]: [1, 2], // IN [1, 2]
            [Op.notIn]: [1, 2], // NOT IN [1, 2]
            [Op.like]: '%hat', // LIKE '%hat'
            [Op.notLike]: '%hat', // NOT LIKE '%hat'
            [Op.iLike]: '%hat', // ILIKE '%hat' (case insensitive)  (PG only)
            [Op.notILike]: '%hat', // NOT ILIKE '%hat'  (PG only)
            [Op.overlap]: [1, 2], // && [1, 2] (PG array overlap operator)
            [Op.contains]: [1, 2], // @> [1, 2] (PG array contains operator)
            [Op.contained]: [1, 2], // <@ [1, 2] (PG array contained by operator)
            [Op.any]: [2, 3], // ANY ARRAY[2, 3]::INTEGER (PG only)
        } as WhereOperators,
        status: {
            [Op.not]: false, // status NOT FALSE
        },
    },
});

// Complex filtering / NOT queries

where = {
    name: 'a project',
    [Op.or]: [{ id: [1, 2, 3] }, { id: { [Op.gt]: 10 } }],
};

where = {
    id: {
        [Op.or]: [[1, 2, 3], { [Op.gt]: 10 }],
    },
    name: 'a project',
};

where = {
    name: 'a project',
    type: {
        [Op.and]: [['a', 'b'], { [Op.notLike]: '%z' }],
    },
};

// [Op.not] example:
where = {
    name: 'a project',
    [Op.not]: [{ id: [1, 2, 3] }, { array: { [Op.contains]: [3, 4, 5] } }],
};

// JSONB

// Nested object

where = {
    meta: {
        video: {
            url: {
                [Op.ne]: null,
            },
        },
    },
};

// Nested key
where = {
    'meta.audio.length': {
        [Op.gt]: 20,
    },
};

// Operator symbols
where = {
    [Op.and]: [{ id: [1, 2, 3] }, { array: { [Op.contains]: [3, 4, 5] } }],
};

// Fn as value
where = {
    [Op.gt]: fn('NOW'),
};
