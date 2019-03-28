import { DataTypes, Model, AttributesTypes, IntanceAttributesTypes } from 'sequelize';
import { sequelize } from './connection';

// I really wouldn't recommend this, but if you want you can still use define() and interfaces

interface User extends Model {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    createdAt: Date;
    updatedAt: Date;
}

type UserModel = {
    new (): User
    customStaticMethod(): unknown
} & typeof Model;

const User = sequelize.define('User', { firstName: DataTypes.STRING }, { tableName: 'users' }) as UserModel;

async function test() {
    User.customStaticMethod();

    const user: User = new User();

    const user2: User = (await User.findOne()) as User;

    user2.firstName = 'John';

    await user2.save();
}


// Types are infered from the model attributes

const Product = sequelize.define('Product', 
    {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true
        }, 
        sku: {
            type: DataTypes.STRING(3),
            /**
             * "as false" is needed for typescript v < 3.4
             * typescript 3.4 will allow to declare object "as const"
             */
            allowNull: false as false 
        },
        availableOn: DataTypes.DATE,
        price: DataTypes.DECIMAL(7,2),
        instock: DataTypes.BOOLEAN
    }, 
    { tableName: 'users' }
);

async function test2() {
   const p = await Product.findOne();

    
    if (p !== null) {
        p.instock = true;
        
        p.price = 10;
        p.price = undefined; // ok

        p.sku = 'P1000';
        // p.sku = undefined; // error, sku does not allow null

        // let availableOn: Date = p.availableOn;
        let sku: string = p.get("sku");
        let instock: boolean = p.get("instock");

        await p.save();
    }


    const p2 = new Product();
    // p2.id = 'NOPE'; // error
    p2.price = 2.67;
    await p2.save();
    
}