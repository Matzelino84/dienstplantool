/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "@request.auth.id != \"\" && @request.auth.rolle = \"admin\"",
    "deleteRule": "@request.auth.id != \"\" && @request.auth.rolle = \"admin\"",
    "fields": [
      {
        "autogeneratePattern": "[a-z0-9]{15}",
        "hidden": false,
        "id": "text3208210256",
        "max": 15,
        "min": 15,
        "name": "id",
        "pattern": "^[a-z0-9]+$",
        "presentable": false,
        "primaryKey": true,
        "required": true,
        "system": true,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "date9222222001",
        "max": "",
        "min": "",
        "name": "datum",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text9222222002",
        "max": 100,
        "min": 0,
        "name": "name",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      },
      {
        "hidden": false,
        "id": "select9222222003",
        "maxSelect": 1,
        "name": "typ",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "feiertag",
          "ferien"
        ]
      }
    ],
    "id": "pbc_feiertage_001",
    "indexes": [
      "CREATE UNIQUE INDEX idx_feiertage_datum ON feiertage (datum)"
    ],
    "listRule": "",
    "name": "feiertage",
    "system": false,
    "type": "base",
    "updateRule": "@request.auth.id != \"\" && @request.auth.rolle = \"admin\"",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_feiertage_001");
  return app.delete(collection);
})
