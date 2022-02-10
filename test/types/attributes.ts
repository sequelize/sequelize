import { Attributes, CreationAttributes, Model, ModelStatic } from 'sequelize';
import { expectTypeOf } from 'expect-type';

class User extends Model<User, { omit: 'projects' | 'address' }> {
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

class Project extends Model<Project> implements ProjectAttributes {
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

expectTypeOf<Attributes<User>>().toEqualTypeOf<{
  id: number,
  name: string,
}>();

// test Attributes works on ModelStatic too
expectTypeOf<Attributes<ModelStatic<User>>>().toEqualTypeOf<{
  id: number,
  name: string,
}>();

expectTypeOf<CreationAttributes<User>>().toEqualTypeOf<{
  id: number,
  name: string,
}>();

// test Attributes works on ModelStatic too
expectTypeOf<CreationAttributes<ModelStatic<User>>>().toEqualTypeOf<{
  id: number,
  name: string,
}>();
