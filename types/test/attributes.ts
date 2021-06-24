import { Model } from "sequelize/lib/model";

interface UserCreationAttributes {
  name: string;
}

interface UserAttributes extends UserCreationAttributes {
  id: number;
}

class User
  extends Model<UserAttributes, UserCreationAttributes>
  implements UserAttributes {
  public id!: number;
  public name!: string;

  public readonly projects?: Project[];
  public readonly address?: Address;
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
  public id!: number;
  public ownerId!: number;
  public name!: string;
}

class Address extends Model {
  public userId!: number;
  public address!: string;
}

// both models should be accepted in include
User.findAll({ include: [Project, Address] });
