/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_3765811651")

  collection.fields.add(new Field({
    "hidden": false,
    "id": "num9555555001",
    "max": null,
    "min": null,
    "name": "ziel_dienste_min",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  collection.fields.add(new Field({
    "hidden": false,
    "id": "num9555555002",
    "max": null,
    "min": null,
    "name": "ziel_dienste_max",
    "onlyInt": true,
    "presentable": false,
    "required": false,
    "system": false,
    "type": "number"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_3765811651")
  collection.fields.removeById("num9555555001")
  collection.fields.removeById("num9555555002")
  return app.save(collection)
})
