import { Model } from "sequelize";

interface UserCreationAttributes {
  name: string;
}

interface UserAttributes extends UserCreationAttributes {
  id: number;
}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  declare id: number;
  declare name: string;

  declare readonly projects?: Project[];
  declare readonly address?: Address;
}

interface ProjectCreationAttributes {
  ownerId: number;
  name: string;
}

interface ProjectAttributes extends ProjectCreationAttributes {
  id: number;
}

class Project
  extends Model<ProjectAttributes, ProjectCreationAttributes>
  implements ProjectAttributes {
  declare id: number;
  declare ownerId: number;
  declare name: string;
}

class Address extends Model {
  declare userId: number;
  declare address: string;
}

// both models should be accepted in include
User.findAll({ include: [Project, Address] });
