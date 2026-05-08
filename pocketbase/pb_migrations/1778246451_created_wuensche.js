/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = new Collection({
    "createRule": "",
    "deleteRule": "hebamme = @request.auth.id",
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
        "cascadeDelete": false,
        "collectionId": "pbc_1600360983",
        "hidden": false,
        "id": "relation2967482128",
        "maxSelect": 1,
        "minSelect": 0,
        "name": "hebamme",
        "presentable": false,
        "required": true,
        "system": false,
        "type": "relation"
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
        "hidden": false,
        "id": "select3475351779",
        "maxSelect": 7,
        "name": "verfuegbar_fuer",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "alle",
          "tagdienst",
          "nachtdienst",
          "bereitschaft",
          "bd_tag",
          "bd_nacht",
          "anmeldung"
        ]
      },
      {
        "hidden": false,
        "id": "select2322959334",
        "maxSelect": 1,
        "name": "frei_wunsch",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "select",
        "values": [
          "wichtig",
          "waere_schoen"
        ]
      },
      {
        "hidden": false,
        "id": "bool3946706270",
        "name": "ist_urlaub",
        "presentable": false,
        "required": false,
        "system": false,
        "type": "bool"
      },
      {
        "hidden": false,
        "id": "number1706814188",
        "max": null,
        "min": null,
        "name": "ziel_dienste",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "hidden": false,
        "id": "number2148100141",
        "max": null,
        "min": null,
        "name": "ziel_anmeldungen",
        "onlyInt": false,
        "presentable": false,
        "required": false,
        "system": false,
        "type": "number"
      },
      {
        "autogeneratePattern": "",
        "hidden": false,
        "id": "text5390320",
        "max": 0,
        "min": 0,
        "name": "besonderheiten",
        "pattern": "",
        "presentable": false,
        "primaryKey": false,
        "required": false,
        "system": false,
        "type": "text"
      }
    ],
    "id": "pbc_3765811651",
    "indexes": [],
    "listRule": "",
    "name": "wuensche",
    "system": false,
    "type": "base",
    "updateRule": "hebamme = @request.auth.id",
    "viewRule": ""
  });

  return app.save(collection);
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3765811651");

  return app.delete(collection);
})
