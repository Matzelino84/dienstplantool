/// <reference path="../pb_data/types.d.ts" />
migrate((app) => {
  const collection = app.findCollectionByNameOrId("pbc_1600360983")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey_pbc_1600360983` ON `hebammen` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email_pbc_1600360983` ON `hebammen` (`email`) WHERE `email` != ''",
      "CREATE UNIQUE INDEX idx_hebammen_vorname ON hebammen (vorname)"
    ],
    "passwordAuth": {
      "identityFields": [
        "vorname"
      ]
    }
  }, collection)

  // update field
  collection.fields.addAt(7, new Field({
    "cost": 0,
    "hidden": true,
    "id": "password901924565",
    "max": 0,
    "min": 4,
    "name": "password",
    "pattern": "",
    "presentable": false,
    "required": true,
    "system": true,
    "type": "password"
  }))

  // update field
  collection.fields.addAt(9, new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "email3885137012",
    "name": "email",
    "onlyDomains": null,
    "presentable": false,
    "required": false,
    "system": true,
    "type": "email"
  }))

  return app.save(collection)
}, (app) => {
  const collection = app.findCollectionByNameOrId("pbc_1600360983")

  // update collection data
  unmarshal({
    "indexes": [
      "CREATE UNIQUE INDEX `idx_tokenKey_pbc_1600360983` ON `hebammen` (`tokenKey`)",
      "CREATE UNIQUE INDEX `idx_email_pbc_1600360983` ON `hebammen` (`email`) WHERE `email` != ''"
    ],
    "passwordAuth": {
      "identityFields": [
        "email"
      ]
    }
  }, collection)

  // update field
  collection.fields.addAt(7, new Field({
    "cost": 0,
    "hidden": true,
    "id": "password901924565",
    "max": 0,
    "min": 8,
    "name": "password",
    "pattern": "",
    "presentable": false,
    "required": true,
    "system": true,
    "type": "password"
  }))

  // update field
  collection.fields.addAt(9, new Field({
    "exceptDomains": null,
    "hidden": false,
    "id": "email3885137012",
    "name": "email",
    "onlyDomains": null,
    "presentable": false,
    "required": true,
    "system": true,
    "type": "email"
  }))

  return app.save(collection)
})
