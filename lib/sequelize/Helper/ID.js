/**
 * Additional helper to deal with the possibility of composite identifiers
 */

module.exports = function(instance) {
  instance.ID = {
    
	   hashToCreateSql: function(idField) {    	
		   if(idField.composite) {
			   // If composite, the fields themselves should just be defined normally as other fields
			   return [];	
		   } else {
			   return ["`" + idField.name + "` INT NOT NULL auto_increment PRIMARY KEY"];
		   }	     
	   },
	   mapResultIdtoObjectId: function(idField, response) {    	
		   
		   if(idField.composite) {
			   
			   var idValue = '', count = 0;			   
			   idField.fields.forEach(function(field) {
				   if(count > 0) idValue += ",";
				   idValue += response[field];
				   count++;
			   });
			   return idValue;
			   
		   } else {
			   			   
			   return response[idField.field];
			   
		   }	     
	   },
	   valuesForUpdate: function(idField,object) {
		   var where = "", count = 0;
		   if(idField.composite) {
			   idField.fields.forEach(function(field) {
				   if(count > 0) where += " AND ";
				   where += "`" + field + "`=" + object[field]
				   count++;
			   });
		   } else {
			   where = "`" + idField.field + "`=" + object[idField.name] 
		   }
		   return where;
	   },
	   valuesForSelect: function(idField,idString) {
		   var where = "", count = 0;
		   var idValues = idString.split(",");
		   
		   if(idField.composite) {
			   idField.fields.forEach(function(field,i) {
				   if(count > 0) where += " AND ";
				   where += "`" + field + "`=" + idValues[i]
				   count++;
			   });
		   } else {
			   where = "`" + idField.field + "`=" + idString
		   }
		   return where;
	   }
	 }
}