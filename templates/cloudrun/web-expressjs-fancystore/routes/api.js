/**
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

var express = require('express');
var router = express.Router();

/* GET users listing. */
router.get('/', function(req, res, next) {
  res.send('Please specify a specific service.');
});

//Load orders and products for pseudo database
const orders = require("../data/orders.json").orders;
const products = require("../data/products.json").products;

//Get all products
router.get("/products", (req, res) => res.json(products));

//Get products by ID
router.get("/products/:id", (req, res) =>
  res.json(products.find(product => product.id === req.params.id))
);

//Get all orders
router.get("/orders", (req, res) => res.json(orders));

//Get orders by ID
router.get("/orders/:id", (req, res) =>
  res.json(orders.find(order => order.id === req.params.id))
);

module.exports = router;
