/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_488194366")

  collection.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text9444444001",
    "max": 5,
    "min": 0,
    "name": "zeit_von",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  collection.fields.add(new Field({
    "autogeneratePattern": "",
    "hidden": false,
    "id": "text9444444002",
    "max": 5,
    "min": 0,
    "name": "zeit_bis",
    "pattern": "",
    "presentable": false,
    "primaryKey": false,
    "required": false,
    "system": false,
    "type": "text"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_488194366")
  collection.fields.removeById("text9444444001")
  collection.fields.removeById("text9444444002")
  return app.save(collection)
})
