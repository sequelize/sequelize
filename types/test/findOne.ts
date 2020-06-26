import { User } from "./models/User";

User.findOne({ where: { firstName: 'John' }});

// The below line should be an error if uncommented, thanks to the new
// TAttributes-based typechecking
// User.findOne({ where: { blah: 'blah2' }});
