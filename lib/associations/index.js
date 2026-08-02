import Association from './base.js';
import BelongsTo from './belongs-to.js';
import HasOne from './has-one.js';
import HasMany from './has-many.js';
import BelongsToMany from './belongs-to-many.js';

Association.BelongsTo = BelongsTo;
Association.HasOne = HasOne;
Association.HasMany = HasMany;
Association.BelongsToMany = BelongsToMany;

export default Association;
export { Association };
