/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3765811651")

  // update field
  collection.fields.addAt(4, new Field({
    "hidden": false,
    "id": "select3475351779",
    "maxSelect": 6,
    "name": "verfuegbar_fuer",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "select",
    "values": [
      "alle",
      "tagdienst",
      "nachtdienst",
      "bd_tag",
      "bd_nacht",
      "anmeldung"
    ]
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3765811651")

  // update field
  collection.fields.addAt(4, new Field({
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
  }))

  return app.save(collection)
})
