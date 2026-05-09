/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1600360983")

  collection.fields.add(new Field({
    "hidden": false,
    "id": "json9111111111",
    "maxSize": 0,
    "name": "settings",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1600360983")
  collection.fields.removeById("json9111111111")
  return app.save(collection)
})
