/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3765811651")

  // dienste_json: array of { typ, zeit_von, zeit_bis } – allows multiple shift entries per day
  collection.fields.add(new Field({
    "hidden": false,
    "id": "json9333333001",
    "maxSize": 0,
    "name": "dienste_json",
    "presentable": false,
    "required": false,
    "system": false,
    "type": "json"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3765811651")
  collection.fields.removeById("json9333333001")
  return app.save(collection)
})
