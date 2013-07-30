Results after syncing the dabatase
----------------------------------

After syncing the database, you'll see in the console the following:

```
Executing: CREATE TABLE IF NOT EXISTS "Trainer" ("first_name" VARCHAR(255), "last_name" VARCHAR(255), "id"   SERIAL , PRIMARY KEY ("id"));
Executing: CREATE TABLE IF NOT EXISTS "Series" ("title" VARCHAR(255), "sub_title" VARCHAR(255), "description" TEXT, "trainer_id" INTEGER REFERENCES "Trainer" ("id"), "id"   SERIAL , PRIMARY KEY ("id"));
Executing: CREATE TABLE IF NOT EXISTS "Video" ("title" VARCHAR(255), "sequence" INTEGER, "description" TEXT, "series_id" INTEGER REFERENCES "Series" ("id"), "id"   SERIAL , PRIMARY KEY ("id"));
```

Notice in the `Video` that `series_id` field has a referential integrity to `Series`:

```
"series_id" INTEGER REFERENCES "Series" ("id")
```

This is the output when describing the table's structure of the Postgres database:

**Trainer** table:
```
testsequelize=> \d+ "Trainer";
                                                        Table "public.Trainer"
   Column   |          Type          |                       Modifiers                        |
------------+------------------------+--------------------------------------------------------+
 first_name | character varying(255) |                                                        |
 last_name  | character varying(255) |                                                        |
 id         | integer                | not null default nextval('"Trainer_id_seq"'::regclass) |
Indexes:
    "Trainer_pkey" PRIMARY KEY, btree (id)
Referenced by:
    TABLE ""Series"" CONSTRAINT "Series_trainer_id_fkey" FOREIGN KEY (trainer_id) REFERENCES "Trainer"(id)
Has OIDs: no
```

**Series** table:
```
testsequelize=> \d+ "Series";
                                                          Table "public.Series"
     Column      |          Type          |                       Modifiers                       |
-----------------+------------------------+-------------------------------------------------------+
 title           | character varying(255) |                                                       |
 sub_title       | character varying(255) |                                                       |
 description     | text                   |                                                       |
 trainer_id      | integer                |                                                       |
 id              | integer                | not null default nextval('"Series_id_seq"'::regclass) |
Indexes:
    "Series_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "Series_trainer_id_fkey" FOREIGN KEY (trainer_id) REFERENCES "Trainer"(id)
Referenced by:
    TABLE ""Video"" CONSTRAINT "Video_series_id_fkey" FOREIGN KEY (series_id) REFERENCES "Series"(id)
Has OIDs: no
```

**Video** table:
```
testsequelize=> \d+ "Video";
                                                        Table "public.Video"
   Column    |          Type          |                      Modifiers                       |
-------------+------------------------+------------------------------------------------------+
 title       | character varying(255) |                                                      |
 sequence    | integer                |                                                      |
 description | text                   |                                                      |
 series_id   | integer                |                                                      |
 id          | integer                | not null default nextval('"Video_id_seq"'::regclass) |
Indexes:
    "Video_pkey" PRIMARY KEY, btree (id)
Foreign-key constraints:
    "Video_series_id_fkey" FOREIGN KEY (series_id) REFERENCES "Series"(id)
Has OIDs: no
```
