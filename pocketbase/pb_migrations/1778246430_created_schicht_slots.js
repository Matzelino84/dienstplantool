/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": null,
    "deleteRule": null,
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
        "id": "date465167916",
        "max": "",
        "min": "",
        "name": "datum",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "date"
      },
      {
        "hidden": false,
        "id": "select37857821",
        "maxSelect": 1,
        "name": "typ",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "select",
        "values": [
          "tagdienst",
          "nachtdienst",
          "bd_tag",
          "bd_nacht",
          "anmeldung"
        ]
      },
      {
        "hidden": false,
        "id": "bool2004509974",
        "name": "ist_feiertag",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text2902633053",
        "max": 0,
        "min": 0,
        "name": "monat",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": true,
        "system": false,
        "type": "text"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text517838324",
        "max": 0,
        "min": 0,
        "name": "notizen",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ],
    "id": "pbc_4095608638",
    "indexes": [],
    "listRule": "",
    "name": "schicht_slots",
    "system": false,
    "type": "base",
    "updateRule": null,
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_4095608638");

  return app.delete(collection);
})
